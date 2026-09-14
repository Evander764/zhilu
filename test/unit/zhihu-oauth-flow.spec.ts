import { webcrypto, createHash } from 'crypto';
jest.mock('../../client/src/api', () => ({
  startZhihuOAuth: jest.fn(),
  completeZhihuOAuth: jest.fn(),
}));
import { startZhihuOAuth, completeZhihuOAuth } from '../../client/src/api';
import {
  beginZhihuConnection,
  consumeZhihuCallback,
} from '../../client/src/pages/ZhihuDemoPage/zhihu-oauth-flow';

describe('browser OAuth handoff', () => {
  const storage = new Map<string, string>();
  const assign = jest.fn();
  const replaceState = jest.fn();
  const location = {
    pathname: '/app/app_17dut1cfq4a/settings/account',
    search: '',
    assign,
  };
  const originals = new Map(
    ['window', 'sessionStorage', 'crypto'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    location.pathname = '/app/app_17dut1cfq4a/settings/account';
    location.search = '';
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location, history: { state: null, replaceState } },
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    jest.mocked(startZhihuOAuth).mockResolvedValue({
      authorizationUrl: 'https://openapi.zhihu.com/authorize?app_id=661',
      ticket: 'signed-ticket',
    });
    jest
      .mocked(completeZhihuOAuth)
      .mockResolvedValue({ authorized: true, readAt: 'test', results: [] });
  });
  afterAll(() =>
    originals.forEach((descriptor, key) => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }),
  );
  it('stores only a browser proof and ticket, and cleans the callback before exchanging', async () => {
    await beginZhihuConnection();
    const pending = JSON.parse([...storage.values()][0]);
    expect(Object.keys(pending).sort()).toEqual(['ticket', 'verifier']);
    expect(startZhihuOAuth).toHaveBeenCalledWith(
      createHash('sha256').update(pending.verifier).digest('hex'),
    );
    location.pathname = '/app/app_17dut1cfq4a/auth/zhihu/callback';
    location.search = '?authorization_code=sensitive-code&state=signed-ticket';
    jest.mocked(completeZhihuOAuth).mockImplementation(async (data) => {
      expect(storage.size).toBe(0);
      expect(replaceState).toHaveBeenCalledWith(null, '', location.pathname);
      expect(data.code).toBe('sensitive-code');
      return { authorized: true, readAt: 'test', results: [] };
    });
    await expect(consumeZhihuCallback()).resolves.toMatchObject({
      authorized: true,
    });
  });
  it.each([
    '?authorization_code=a&authorization_code=b',
    '?code=a&authorization_code=b',
    '?code=a&state=x&state=y',
  ])('rejects duplicate parameters: %s', async (search) => {
    await beginZhihuConnection();
    location.pathname = '/auth/zhihu/callback';
    location.search = search;
    await expect(consumeZhihuCallback()).rejects.toThrow('授权参数重复');
    expect(completeZhihuOAuth).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });
  it('handles denial without calling data APIs and removes pending flow', async () => {
    await beginZhihuConnection();
    location.pathname = '/auth/zhihu/callback';
    location.search = '?error=access_denied';
    await expect(consumeZhihuCallback()).rejects.toThrow('知乎授权未完成');
    expect(completeZhihuOAuth).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });
  it('does not process arbitrary pages or direct callbacks with no proof', async () => {
    expect(consumeZhihuCallback()).toBeNull();
    location.pathname = '/auth/zhihu/callback';
    location.search = '?code=a';
    await expect(consumeZhihuCallback()).rejects.toThrow('本次连接已过期');
    expect(completeZhihuOAuth).not.toHaveBeenCalled();
  });
  it('refuses a foreign authorization destination', async () => {
    jest
      .mocked(startZhihuOAuth)
      .mockResolvedValue({
        authorizationUrl: 'https://example.com/',
        ticket: 'x',
      });
    await expect(beginZhihuConnection()).rejects.toThrow('授权地址无效');
    expect(assign).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });
});
