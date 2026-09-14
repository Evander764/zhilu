import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { AxiosRequestConfig } from 'axios';
import type {
  ZhihuOAuthCompletion,
  ZhihuOAuthCompletionInput,
  ZhihuOAuthDataResult,
  ZhihuOAuthItem,
  ZhihuOAuthStart,
  ZhihuOAuthStatus,
} from '../../../shared/api.interface';
import { makeTicket, MIAODA_CALLBACK, verifyTicket } from './oauth-state';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown, limit = 240): string {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, '').slice(0, limit)
    : '';
}
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url: URL = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      ['www.zhihu.com', 'zhihu.com', 'zhuanlan.zhihu.com'].includes(
        url.hostname,
      )
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
function displayItem(value: unknown): ZhihuOAuthItem {
  const item = record(value);
  return {
    title: text(item.Title || item.Fullname, 160) || '查看知乎原内容',
    summary: text(item.Summary || item.Description || item.Headline),
    url: safeUrl(item.Url),
  };
}
function favlistId(value: unknown): string | null {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0))
    return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const id: string = String(value);
  return /^[1-9]\d{0,18}$/.test(id) ? id : null;
}

@Injectable()
export class ZhihuOAuthService {
  constructor(private readonly http: HttpService) {}

  status(signedIn: boolean): ZhihuOAuthStatus {
    const configured: boolean =
      process.env.ZHIHU_OAUTH_APP_ID === '661' &&
      Boolean(process.env.ZHIHU_OAUTH_APP_KEY?.trim()) &&
      Boolean(process.env.ZHIHU_OAUTH_ACCESS_SECRET?.trim()) &&
      process.env.ZHIHU_OAUTH_REDIRECT_URI === MIAODA_CALLBACK;
    // Confirmation is tied to this exact URL; a prior host's confirmation cannot carry over.
    const callbackRegistered: boolean =
      process.env.ZHIHU_OAUTH_REGISTERED_REDIRECT_URI === MIAODA_CALLBACK;
    return {
      version: 'miaoda-zhihu-oauth-661-v1',
      appId: '661',
      redirectUri: MIAODA_CALLBACK,
      configured,
      callbackRegistered,
      ready: configured && callbackRegistered,
      signedIn,
      message: !configured
        ? '知乎连接正在配置中。'
        : !callbackRegistered
          ? '等待知乎登记回调，完成后即可连接。'
          : '连接后，可查看你授权范围内的知乎创作、关注和收藏。',
    };
  }
  private key(): string {
    if (!this.status(true).ready)
      throw new ServiceUnavailableException(this.status(true).message);
    return process.env.ZHIHU_OAUTH_APP_KEY!.trim();
  }
  start(userId: string, proof: string): ZhihuOAuthStart {
    const ticket: string = makeTicket(userId, proof, this.key());
    const url: URL = new URL('https://openapi.zhihu.com/authorize');
    url.search = new URLSearchParams({
      app_id: '661',
      redirect_uri: MIAODA_CALLBACK,
      response_type: 'code',
      state: ticket,
    }).toString();
    return { authorizationUrl: url.toString(), ticket };
  }
  private async request(options: AxiosRequestConfig): Promise<unknown> {
    try {
      const response = await this.http.axiosRef.request<unknown>({
        ...options,
        timeout: 8000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        maxBodyLength: 32768,
      });
      return response.data;
    } catch {
      // Axios errors include headers/form secrets; never pass their cause or request to logs/filters.
      throw new BadGatewayException('知乎服务暂时不可用，请稍后重新连接。');
    }
  }
  async complete(
    userId: string,
    input: ZhihuOAuthCompletionInput,
  ): Promise<ZhihuOAuthCompletion> {
    const key: string = this.key();
    verifyTicket(input.ticket, input.state, input.verifier, userId, key);
    const payload = record(
      await this.request({
        method: 'POST',
        url: 'https://openapi.zhihu.com/access_token',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: new URLSearchParams({
          app_id: '661',
          app_key: key,
          grant_type: 'authorization_code',
          redirect_uri: MIAODA_CALLBACK,
          code: input.code,
        }).toString(),
      }),
    );
    const token: unknown =
      payload.access_token ??
      record(payload.data).access_token ??
      record(payload.Data).access_token;
    if (typeof token !== 'string' || !token.trim() || token.length > 16384)
      throw new BadGatewayException('未取得有效的知乎授权，请重新连接。');
    // Token exists only inside this request. No process session, DB, cookie or browser token storage.
    const results: ZhihuOAuthDataResult[] = await this.readData(token);
    return { authorized: true, readAt: new Date().toISOString(), results };
  }
  private async readData(token: string): Promise<ZhihuOAuthDataResult[]> {
    if (!token) throw new BadGatewayException('缺少知乎用户授权。');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.ZHIHU_OAUTH_ACCESS_SECRET!.trim()}`,
      'X-OAuth-Token': token,
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
      'Content-Type': 'application/json',
    };
    const read = async (
      id: string,
      name: string,
      query: Record<string, string> = {},
    ) => {
      try {
        const payload = record(
          await this.request({
            method: 'GET',
            url: `https://developer.zhihu.com/api/v1/user/${id}`,
            params: { Limit: '1', ...query },
            headers,
          }),
        );
        const items: unknown = record(payload.Data).Items;
        if (payload.Code !== 0 || !Array.isArray(items))
          throw new Error('Invalid data');
        const first: unknown = items[0];
        if (
          items.length &&
          (typeof first !== 'object' || first === null || Array.isArray(first))
        )
          throw new Error('Invalid item');
        const result: ZhihuOAuthDataResult = {
          id,
          name,
          status: items.length ? 'success' : 'empty',
          message: items.length ? '已读取 1 条' : '暂无此类公开数据',
          item: items.length ? displayItem(first) : null,
        };
        return {
          result,
          folderId:
            id === 'favlists' ? favlistId(record(first).UrlToken) : null,
        };
      } catch {
        const result: ZhihuOAuthDataResult = {
          id,
          name,
          status: 'error',
          message: '读取失败，请检查授权或稍后重试',
          item: null,
        };
        return { result, folderId: null };
      }
    };
    const [contents, followees, favlists, collections] = await Promise.all([
      read('contents', '我的创作', {
        ContentType: 'all',
        Offset: '0',
        SortField: 'ts',
        SortOrder: 'desc',
      }),
      read('followees', '我的关注', { Offset: '0' }),
      read('favlists', '收藏夹'),
      read('collections', '近期收藏'),
    ]);
    const folder: ZhihuOAuthDataResult = favlists.folderId
      ? (
          await read('favlist_contents', '收藏夹内容', {
            FavlistUrlToken: favlists.folderId,
            Offset: '0',
          })
        ).result
      : {
          id: 'favlist_contents',
          name: '收藏夹内容',
          status: favlists.result.status === 'empty' ? 'empty' : 'error',
          item: null,
          message:
            favlists.result.status === 'empty'
              ? '暂无可读取的收藏夹'
              : '未取得有效收藏夹，无法读取',
        };
    return [
      contents.result,
      followees.result,
      favlists.result,
      folder,
      collections.result,
    ];
  }
}
