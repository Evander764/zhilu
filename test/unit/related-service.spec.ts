import 'reflect-metadata';
import { HttpService } from '@nestjs/axios';
import { HttpException, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { ZhiluService } from '../../server/modules/zhilu/zhilu.service';
import { RelatedController } from '../../server/modules/zhilu/related.controller';
import { ZhiluModule } from '../../server/modules/zhilu/zhilu.module';

const raw = {
  Code: 0,
  Data: {
    Items: [
      {
        Title: '真实链接形状的测试问题',
        AuthorName: '测试作者',
        ContentText: '测试片段',
        Url: 'https://www.zhihu.com/question/101/answer/202',
        ContentType: 'Answer',
        ContentID: '-303',
      },
    ],
  },
};
describe('related endpoint uses the real search service with boundary adapters', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.ZHILU_SEARCH_TRANSPORT = 'http';
    process.env.ZHIHU_ACCESS_SECRET = 'synthetic-test-secret';
    delete process.env.ZHILU_SEARCH_ENABLED;
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });
  function setup() {
    const execute = jest.fn().mockResolvedValue([{ status: 'allowed' }]);
    const get = jest.fn().mockResolvedValue({ data: raw });
    const service = new ZhiluService(
      { execute } as unknown as PostgresJsDatabase,
      { axiosRef: { get } } as unknown as HttpService,
    );
    return {
      execute,
      get,
      service,
      controller: new RelatedController(service),
    };
  }
  test('Nest registers the public POST controller and resolves its actual service', async () => {
    const { execute, get } = setup();
    expect(Reflect.getMetadata('controllers', ZhiluModule)).toContain(
      RelatedController,
    );
    expect(Reflect.getMetadata('path', RelatedController)).toBe(
      'api/zhilu/related',
    );
    expect(
      Reflect.getMetadata('method', RelatedController.prototype.search),
    ).toBe(RequestMethod.POST);
    const module = await Test.createTestingModule({
      controllers: [RelatedController],
      providers: [
        ZhiluService,
        { provide: DRIZZLE_DATABASE, useValue: { execute } },
        { provide: HttpService, useValue: { axiosRef: { get } } },
      ],
    }).compile();
    const result = await module
      .get(RelatedController)
      .search({ query: '示例标题' });
    expect(result.questions[0]).toMatchObject({
      questionId: '101',
      answers: [{ answerId: '202', upstreamContentId: '-303' }],
    });
    expect(get.mock.calls[0][1].params).toEqual({
      Query: '示例标题',
      Count: 10,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    await module.close();
  });
  test('rejects demo node IDs, bad titles and dangerous request objects before budget or upstream', async () => {
    const { controller, execute, get } = setup();
    for (const input of [
      { query: '' },
      { query: '问题', questionId: 'learning-with-ai' },
      { query: '问题', nodeId: 'legacy' },
      { query: '问题\u0000' },
    ]) {
      await expect(controller.search(input)).rejects.toMatchObject({
        status: 400,
      });
    }
    expect(execute).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
  test('same in-flight search consumes a single global slot, then caches for five minutes', async () => {
    const { service, controller, get, execute } = setup();
    let finish!: (value: { data: typeof raw }) => void;
    const upstream = new Promise((resolve) => {
      finish = resolve;
    });
    get.mockReturnValue(upstream);
    const a = controller.search({ query: '相同问题' });
    const b = controller.search({ query: '相同问题', questionId: '101' });
    finish({ data: raw });
    const [first, second] = await Promise.all([a, b]);
    expect(first.root.questionId).toBeNull();
    expect(second.root.questionId).toBe('101');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect((await service.search({ query: '相同问题' })).cached).toBe(true);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 300001);
    get.mockResolvedValue({ data: raw });
    expect((await controller.search({ query: '相同问题' })).cached).toBe(false);
    expect(get).toHaveBeenCalledTimes(2);
  });
  test('rejected pending searches clear correctly so explicit retry can succeed', async () => {
    const { controller, get, execute } = setup();
    get.mockRejectedValueOnce(
      new Error('network includes synthetic-test-secret'),
    );
    const results = await Promise.allSettled([
      controller.search({ query: '失败问题' }),
      controller.search({ query: '失败问题' }),
    ]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(get).toHaveBeenCalledTimes(1);
    expect(await controller.search({ query: '失败问题' })).toMatchObject({
      questions: [{ questionId: '101' }],
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });
  test.each([
    [20001, 401],
    [30001, 429],
    [30002, 429],
    [99999, 503],
  ])('maps upstream business code %s to HTTP %s', async (Code, status) => {
    const { controller, get } = setup();
    get.mockResolvedValue({ data: { Code } });
    await expect(
      controller.search({ query: '测试问题' }),
    ).rejects.toMatchObject({ status });
  });
  test.each([
    [401, 401],
    [403, 401],
    [429, 429],
    [500, 503],
  ])('maps HTTP failure %s to %s safely', async (upstream, expected) => {
    const { controller, get } = setup();
    get.mockRejectedValue({
      response: { status: upstream },
      message: 'synthetic-test-secret',
    });
    try {
      await controller.search({ query: '测试问题' });
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(expected);
      expect(String(error)).not.toContain('synthetic-test-secret');
    }
  });
  test.each([
    { Code: 0 },
    { Code: 0, Data: null },
    { Code: 0, Data: { Items: {} } },
    { failure: 'service' },
  ])('malformed successful payload is not empty %#', async (data) => {
    const { controller, get } = setup();
    get.mockResolvedValue({ data });
    await expect(
      controller.search({ query: '测试问题' }),
    ).rejects.toMatchObject({ status: 503 });
  });
  test('valid empty search succeeds without inventing nodes', async () => {
    const { controller, get } = setup();
    get.mockResolvedValue({ data: { Code: 0, Data: { Items: [] } } });
    expect(await controller.search({ query: '测试问题' })).toMatchObject({
      questions: [],
      articles: [],
    });
  });
  test.each(['quota', 'burst', 'unknown'])(
    'budget %s blocks upstream request',
    async (status) => {
      const { controller, get, execute } = setup();
      execute.mockResolvedValue([{ status }]);
      await expect(
        controller.search({ query: '测试问题' }),
      ).rejects.toMatchObject({ status: status === 'unknown' ? 503 : 429 });
      expect(get).not.toHaveBeenCalled();
    },
  );
  test('missing quota function fails safely and never falls back to unbudgeted upstream', async () => {
    const { controller, get, execute } = setup();
    execute.mockRejectedValue({ code: '42883' });
    await expect(
      controller.search({ query: '测试问题' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(get).not.toHaveBeenCalled();
  });
});
