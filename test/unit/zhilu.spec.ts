import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import {
  normalizeItems,
  safeZhihuUrl,
  searchInput,
  shanghaiDay,
} from '../../server/modules/zhilu/search-utils';
import { ZhiluService } from '../../server/modules/zhilu/zhilu.service';
import { parsePath } from '../../shared/path';
import type { Graph } from '../../shared/api.interface';

// Synthetic fixtures are test-only and never enter the published catalog.
const graph = {
  nodes: [
    { id: 'a', stage: '练习' },
    { id: 'b', stage: '反馈' },
  ],
  edges: [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'a' },
  ],
} as Graph;
describe('public reading paths', () => {
  test('restores known connected nodes in order', () =>
    expect(parsePath('a.b.a', graph)).toEqual(['a', 'b', 'a']));
  test.each([
    'missing',
    'a.missing',
    'a.a',
    'a.b..a',
    Array(26).fill('a.b').join('.'),
  ])('rejects invalid path %s', (value) =>
    expect(parsePath(value, graph)).toBeNull(),
  );
  test('empty path returns home', () =>
    expect(parsePath(null, graph)).toEqual([]));
});
describe('search boundaries', () => {
  test.each([
    'javascript:alert(1)',
    'https://zhihu.com.evil.test/x',
    'https://user:pass@zhihu.com/x',
    'http://www.zhihu.com/x',
  ])('rejects unsafe source %s', (value) =>
    expect(safeZhihuUrl(value)).toBe(false),
  );
  test('rejects empty, huge and non-string queries', () => {
    for (const query of ['', 'a', 'a'.repeat(121), {}, null])
      expect(searchInput.safeParse({ query }).success).toBe(false);
  });
  test('deduplicates, strips tags and caps results at ten', () => {
    const item = {
      Title: '<b>Test</b>',
      ContentText: '<img src=x onerror=alert(1)>文字',
      AuthorName: '<i>作者</i>',
      Url: 'https://www.zhihu.com/question/1/answer/1',
    };
    const items = normalizeItems({
      Code: 0,
      Data: {
        Items: [
          item,
          item,
          { ...item, Url: 'javascript:alert(1)' },
          ...Array.from({ length: 15 }, (_, i) => ({
            ...item,
            Url: `https://www.zhihu.com/question/1/answer/${i + 2}`,
          })),
        ],
      },
    });
    expect(items).toHaveLength(10);
    expect(items[0]).toMatchObject({
      title: 'Test',
      excerpt: '文字',
      author: '作者',
    });
  });
  test('valid empty result stays empty', () =>
    expect(normalizeItems({ Code: 0, Data: { Items: [] } })).toEqual([]));
  test('daily quota resets at Shanghai midnight', () => {
    expect(shanghaiDay(new Date('2026-09-05T15:59:59Z'))).toBe('2026-09-05');
    expect(shanghaiDay(new Date('2026-09-05T16:00:00Z'))).toBe('2026-09-06');
  });
});
describe('upstream failure isolation and budget', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.ZHIHU_ACCESS_SECRET = 'unit-test-only';
    process.env.ZHILU_SEARCH_TRANSPORT = 'http';
    delete process.env.ZHILU_SEARCH_ENABLED;
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });
  function setup(status = 'allowed') {
    const execute = jest.fn().mockResolvedValue([{ status }]);
    const db = { execute };
    const get = jest.fn();
    const service = new ZhiluService(
      db as unknown as PostgresJsDatabase,
      { axiosRef: { get } } as unknown as HttpService,
    );
    jest.spyOn(service, 'graph').mockResolvedValue(graph);
    return { service, get, execute };
  }
  test('cache reuses query without a second upstream call', async () => {
    const { service, get } = setup();
    get.mockResolvedValue({ data: { Code: 0, Data: { Items: [] } } });
    expect((await service.search({ query: '测试' })).cached).toBe(false);
    expect((await service.search({ query: '测试' })).cached).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1]).toMatchObject({
      timeout: 12000,
      maxRedirects: 0,
      params: { Count: 10 },
    });
  });
  test('burst limit prevents external request', async () => {
    const { service, get } = setup('burst');
    await expect(service.search({ query: '测试' })).rejects.toMatchObject({
      status: 429,
    });
    expect(get).not.toHaveBeenCalled();
  });
  test('daily quota prevents external request', async () => {
    const { service, get } = setup('quota');
    await expect(service.search({ query: '测试' })).rejects.toMatchObject({
      status: 429,
    });
    expect(get).not.toHaveBeenCalled();
    expect(await service.graph()).toBe(graph);
  });
  test('disabled search still permits reading', async () => {
    process.env.ZHILU_SEARCH_ENABLED = 'false';
    const { service, get } = setup();
    await expect(service.search({ query: '测试' })).rejects.toMatchObject({
      status: 503,
    });
    expect(await service.graph()).toBe(graph);
    expect(get).not.toHaveBeenCalled();
  });
  test('timeout returns safe error without secret or query', async () => {
    const { service, get } = setup();
    get.mockRejectedValue(
      new Error('ECONNABORTED unit-test-only 用户完整查询'),
    );
    try {
      await service.search({ query: '用户完整查询' });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(String(error)).not.toMatch(/unit-test-only|用户完整查询/);
      expect((error as HttpException).getStatus()).toBe(503);
    }
    expect(await service.graph()).toBe(graph);
  });
  test('invalid upstream payload and upstream throttle are not fake results', async () => {
    const a = setup();
    a.get.mockResolvedValue({ data: { unexpected: true } });
    await expect(a.service.search({ query: '测试' })).rejects.toMatchObject({
      status: 503,
    });
    const b = setup();
    b.get.mockResolvedValue({ data: { Code: 30001 } });
    await expect(b.service.search({ query: '测试' })).rejects.toMatchObject({
      status: 429,
    });
  });
  test('unknown contextual node fails before calling external service', async () => {
    const { service, get } = setup();
    await expect(
      service.search({ query: '测试', nodeId: 'unknown' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(get).not.toHaveBeenCalled();
  });
});
