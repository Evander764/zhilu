import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { Request } from 'express';
import {
  digest,
  makeTicket,
  MIAODA_CALLBACK,
  verifyTicket,
} from '../../server/modules/zhihu-oauth/oauth-state';
import { ZhihuOAuthService } from '../../server/modules/zhihu-oauth/zhihu-oauth.service';
import { ZhihuOAuthController } from '../../server/modules/zhihu-oauth/zhihu-oauth.controller';
import { ZhihuOAuthModule } from '../../server/modules/zhihu-oauth/zhihu-oauth.module';

const KEY = 'test-only-application-key';
const SECRET = 'test-only-developer-secret';
const TOKEN = 'test-only-user-oauth-token';
const VERIFIER = 'a'.repeat(64);
const USER = '9223372036854775806';
const envKeys = [
  'ZHIHU_OAUTH_APP_ID',
  'ZHIHU_OAUTH_APP_KEY',
  'ZHIHU_OAUTH_ACCESS_SECRET',
  'ZHIHU_OAUTH_REDIRECT_URI',
  'ZHIHU_OAUTH_REGISTERED_REDIRECT_URI',
];
const savedEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);

describe('Zhihu OAuth integration', () => {
  let service: ZhihuOAuthService;
  let requests: InternalAxiosRequestConfig[];
  let reply: (config: AxiosRequestConfig) => unknown;
  const input = () => {
    const ticket = makeTicket(USER, digest(VERIFIER), KEY);
    return {
      code: 'test-authorization-code',
      state: ticket,
      ticket,
      verifier: VERIFIER,
    };
  };
  beforeEach(() => {
    Object.assign(process.env, {
      ZHIHU_OAUTH_APP_ID: '661',
      ZHIHU_OAUTH_APP_KEY: KEY,
      ZHIHU_OAUTH_ACCESS_SECRET: SECRET,
      ZHIHU_OAUTH_REDIRECT_URI: MIAODA_CALLBACK,
      ZHIHU_OAUTH_REGISTERED_REDIRECT_URI: MIAODA_CALLBACK,
    });
    requests = [];
    reply = (config) =>
      config.method === 'post'
        ? { code: 20000, data: { access_token: TOKEN } }
        : {
            Code: 0,
            Data: {
              Items: [
                {
                  Title: '公开测试内容',
                  Url: 'https://www.zhihu.com/question/1',
                  UrlToken: '123',
                },
              ],
            },
          };
    service = new ZhihuOAuthService(
      new HttpService(
        axios.create({
          adapter: async (config) => {
            requests.push(config);
            return {
              data: reply(config),
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            };
          },
        }),
      ),
    );
  });
  afterAll(() =>
    envKeys.forEach((key) => {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }),
  );

  it('waits for confirmation of this exact callback and exposes no credentials', () => {
    process.env.ZHIHU_OAUTH_REGISTERED_REDIRECT_URI =
      'https://zhihu-oauth-demo.vercel.app/auth/callback';
    const status = service.status(false);
    expect(status).toMatchObject({
      configured: true,
      ready: false,
      callbackRegistered: false,
      signedIn: false,
    });
    expect(() => service.start(USER, digest(VERIFIER))).toThrow(
      '等待知乎登记回调',
    );
    expect(JSON.stringify(status)).not.toMatch(/test-only/);
    expect(requests).toHaveLength(0);
  });
  it('does not use a loopback or other application callback', () => {
    process.env.ZHIHU_OAUTH_REDIRECT_URI = 'http://127.0.0.1';
    expect(service.status(true).configured).toBe(false);
    expect(() => service.start(USER, digest(VERIFIER))).toThrow();
  });
  it('builds the registered authorization URL without a key or user identifier', () => {
    const result = service.start(USER, digest(VERIFIER));
    const url = new URL(result.authorizationUrl);
    expect(url.origin).toBe('https://openapi.zhihu.com');
    expect(url.searchParams.get('redirect_uri')).toBe(MIAODA_CALLBACK);
    expect(url.searchParams.get('state')).toBe(result.ticket);
    expect(result.authorizationUrl).not.toContain(KEY);
    expect(
      Buffer.from(result.ticket.split('.')[0], 'base64url').toString(),
    ).not.toContain(USER);
  });
  it.each([
    'absent-state',
    'wrong-state',
    'wrong-verifier',
    'other-user',
    'tampered-ticket',
    'expired',
  ])('rejects %s before exchanging a code', async (reason) => {
    const data = input();
    let owner = USER;
    if (reason === 'absent-state') data.state = '';
    if (reason === 'wrong-state') data.state = 'foreign';
    if (reason === 'wrong-verifier') data.verifier = 'b'.repeat(64);
    if (reason === 'other-user') owner = '9223372036854775805';
    if (reason === 'tampered-ticket')
      data.state = data.ticket = `${data.ticket}x`;
    if (reason === 'expired')
      data.state = data.ticket = makeTicket(
        USER,
        digest(VERIFIER),
        KEY,
        Date.now() - 600001,
      );
    await expect(service.complete(owner, data)).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });
  it('validates a callback across process instances without an in-memory session', () => {
    const ticket = makeTicket(USER, digest(VERIFIER), KEY);
    expect(() =>
      verifyTicket(ticket, ticket, VERIFIER, USER, KEY),
    ).not.toThrow();
  });
  it('exchanges the code on the backend and reads all five interfaces with both credentials', async () => {
    const result = await service.complete(USER, input());
    expect(result.results.map((item) => item.status)).toEqual(
      Array(5).fill('success'),
    );
    expect(requests).toHaveLength(6);
    const form = new URLSearchParams(requests[0].data);
    expect(form.get('app_key')).toBe(KEY);
    expect(form.get('code')).toBe('test-authorization-code');
    expect(form.get('redirect_uri')).toBe(MIAODA_CALLBACK);
    for (const request of requests.slice(1)) {
      expect(request.headers.Authorization).toBe(`Bearer ${SECRET}`);
      expect(request.headers['X-OAuth-Token']).toBe(TOKEN);
      expect(request.params.Limit).toBe('1');
      expect(request.maxRedirects).toBe(0);
    }
    expect(
      requests.find((req) => req.url.endsWith('/favlist_contents')).params
        .FavlistUrlToken,
    ).toBe('123');
    expect(JSON.stringify(result)).not.toMatch(
      /test-only|test-authorization-code/,
    );
  });
  it('does not fall back to developer identity when token exchange fails', async () => {
    reply = () => ({ code: 20001 });
    await expect(service.complete(USER, input())).rejects.toThrow(
      BadGatewayException,
    );
    expect(requests).toHaveLength(1);
  });
  it('handles an empty collection and skips the dependent content read', async () => {
    reply = (config) =>
      config.method === 'post'
        ? { access_token: TOKEN }
        : { Code: 0, Data: { Items: [] } };
    const result = await service.complete(USER, input());
    expect(result.results.map((item) => item.status)).toEqual(
      Array(5).fill('empty'),
    );
    expect(requests).toHaveLength(5);
  });
  it.each([undefined, { Items: 'not-a-list' }, { Items: [null] }])(
    'treats malformed data as failure, never empty',
    async (data) => {
      reply = (config) =>
        config.method === 'post'
          ? { access_token: TOKEN }
          : { Code: 0, Data: data };
      const result = await service.complete(USER, input());
      expect(result.results.every((item) => item.status === 'error')).toBe(
        true,
      );
    },
  );
  it('does not silently round a large collection identifier or expose unexpected data', async () => {
    reply = (config) =>
      config.method === 'post'
        ? { access_token: TOKEN }
        : {
            Code: 0,
            Data: {
              Items: [
                {
                  UrlToken: Number.MAX_SAFE_INTEGER + 2,
                  Title: '<script>x</script>',
                  Url: 'javascript:alert(1)',
                  access_token: TOKEN,
                  privateField: SECRET,
                },
              ],
            },
          };
    const result = await service.complete(USER, input());
    expect(result.results[3].status).toBe('error');
    expect(result.results[0].item.url).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/script|test-only|javascript/);
  });
  it('contains exceptions with embedded credentials', async () => {
    reply = () => {
      throw new Error(`${KEY} ${TOKEN} ${SECRET}`);
    };
    await expect(service.complete(USER, input())).rejects.toThrow(
      '知乎服务暂时不可用',
    );
  });
  it('blocks anonymous/system callers and rejects a caller-supplied owner', () => {
    const controller = new ZhihuOAuthController(service);
    const anonymous = { userContext: { userId: '' } } as Request;
    const system = {
      userContext: { userId: USER, isSystemAccount: true },
    } as Request;
    const loggedIn = { userContext: { userId: USER } } as Request;
    for (const req of [anonymous, system]) {
      expect(() => controller.start(req, { proof: digest(VERIFIER) })).toThrow(
        UnauthorizedException,
      );
      expect(() => controller.complete(req, input())).toThrow(
        UnauthorizedException,
      );
    }
    expect(() =>
      controller.start(loggedIn, { proof: digest(VERIFIER), owner: USER }),
    ).toThrow();
    expect(() =>
      controller.complete(loggedIn, { ...input(), owner: USER }),
    ).toThrow();
    expect(requests).toHaveLength(0);
  });
  it('registers the controller with a private HTTP client', async () => {
    const module = await Test.createTestingModule({
      imports: [HttpModule, ZhihuOAuthModule],
    }).compile();
    await module.init();
    const controller = module.get(ZhihuOAuthController);
    const oauthModule = module.select(ZhihuOAuthModule);
    expect(controller).toBeDefined();
    expect(oauthModule.get(HttpService).axiosRef).not.toBe(axios);
    await module.close();
  });
});
