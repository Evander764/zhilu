import { z } from 'zod';
import { completeZhihuOAuth, startZhihuOAuth } from '../../api';
import type { ZhihuOAuthCompletion } from '../../../../shared/api.interface';

const STORAGE_KEY = 'zhilu:zhihu-oauth:pending:v1';
const pendingSchema = z.object({
  verifier: z.string().regex(/^[a-f0-9]{64}$/),
  ticket: z.string().min(1).max(4096),
});
const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value: number) =>
    value.toString(16).padStart(2, '0'),
  ).join('');

export async function beginZhihuConnection(): Promise<void> {
  const verifier: string = hex(crypto.getRandomValues(new Uint8Array(32)));
  const proof: string = hex(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ),
  );
  const { authorizationUrl, ticket } = await startZhihuOAuth(proof);
  const target: URL = new URL(authorizationUrl);
  if (
    target.origin !== 'https://openapi.zhihu.com' ||
    target.pathname !== '/authorize'
  )
    throw new Error('授权地址无效，请联系应用管理员。');
  // Only the local flow proof is stored; OAuth codes/tokens/user data never enter web storage.
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, ticket }));
  window.location.assign(target.toString());
}

export function consumeZhihuCallback(): Promise<ZhihuOAuthCompletion> | null {
  if (!window.location.pathname.endsWith('/auth/zhihu/callback')) return null;
  const params: URLSearchParams = new URLSearchParams(window.location.search);
  const codes: string[] = params.getAll('authorization_code');
  const legacyCodes: string[] = params.getAll('code');
  const states: string[] = params.getAll('state');
  // Remove front-channel credentials from history before any API request or navigation.
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname,
  );
  return (async () => {
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      throw new Error('浏览器无法读取本次授权信息，请允许网站存储后重新连接。');
    }
    if (params.has('error')) throw new Error('知乎授权未完成，可以重新连接。');
    if (!codes.length && !legacyCodes.length)
      throw new Error('尚未收到知乎授权，请从“连接知乎”入口开始。');
    if (
      codes.length > 1 ||
      legacyCodes.length > 1 ||
      states.length > 1 ||
      (codes.length && legacyCodes.length)
    )
      throw new Error('授权参数重复，请重新连接知乎。');
    let pending: unknown;
    try {
      pending = JSON.parse(raw || 'null');
    } catch {
      pending = null;
    }
    const parsed = pendingSchema.safeParse(pending);
    if (!parsed.success)
      throw new Error('本次连接已过期，请从当前浏览器重新连接知乎。');
    return completeZhihuOAuth({
      code: codes[0] || legacyCodes[0],
      state: states[0] || '',
      ticket: parsed.data.ticket,
      verifier: parsed.data.verifier,
    });
  })();
}
