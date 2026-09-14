import {
  RelatedRequests,
  observeRelated,
  relatedErrorKind,
  visibilityForQuestion,
} from '../../client/src/pages/ZhihuDemoPage/related-requests';
import {
  buildRelatedTree,
  relatedQuestionPath,
  relatedRouteRequest,
  relatedTreeSchema,
} from '../../shared/related-tree';
import type { RelatedTree } from '../../shared/related-tree';
const tree = (query: string) =>
  buildRelatedTree(
    { query },
    { items: [], cached: false, fetchedAt: '2026-09-14T16:00:00.000Z' },
  );
describe('related navigation request lifecycle', () => {
  test('closing A suppresses A, selecting B restores automatic search, back to A restores it too', async () => {
    const load = jest.fn((input) => Promise.resolve(tree(input.query)));
    const requests = new RelatedRequests(load);
    let visibility = { questionKey: 'A', open: true };
    await requests.get({ query: '问题A' });
    visibility = { ...visibility, open: false };
    visibility = visibilityForQuestion(visibility, 'A');
    expect(visibility.open).toBe(false);
    if (visibility.open) await requests.get({ query: '问题A' });
    expect(load).toHaveBeenCalledTimes(1);
    visibility = visibilityForQuestion(visibility, 'B');
    expect(visibility.open).toBe(true);
    if (visibility.open) await requests.get({ query: '问题B' });
    expect(load).toHaveBeenLastCalledWith({ query: '问题B' });
    visibility = visibilityForQuestion({ ...visibility, open: false }, 'A');
    expect(visibility.open).toBe(true);
    expect((await requests.get({ query: '问题A' })).cached).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  test('question links carry real ID and title and restore the next selected search after refresh/back', () => {
    const path = relatedQuestionPath({
      questionId: '1234567890123456789',
      title: 'AI & 编程？ - 知乎',
    });
    const url = new URL(path, 'https://app.test');
    expect(url.pathname).toBe('/question/1234567890123456789');
    expect(
      relatedRouteRequest(
        url.pathname.split('/')[2],
        url.searchParams.get('title'),
      ),
    ).toEqual({ questionId: '1234567890123456789', query: 'AI & 编程？' });
    expect(relatedRouteRequest('learning-with-ai', '测试问题')).toBeNull();
    expect(relatedRouteRequest('123', null)).toBeNull();
  });
  test('fast switch drops stale success and stale failure, renders only the latest selection', async () => {
    let resolveFirst!: (tree: RelatedTree) => void;
    let rejectOld!: (error: unknown) => void;
    const ready = jest.fn(),
      failed = jest.fn();
    const first = new Promise<RelatedTree>((resolve) => {
      resolveFirst = resolve;
    });
    const oldError = new Promise<RelatedTree>((_resolve, reject) => {
      rejectOld = reject;
    });
    const cancelFirst = observeRelated(first, ready, failed);
    const cancelError = observeRelated(oldError, ready, failed);
    cancelFirst();
    cancelError();
    observeRelated(Promise.resolve(tree('新问题')), ready, failed);
    resolveFirst(tree('旧问题'));
    rejectOld(new Error('old'));
    await Promise.resolve();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready.mock.calls[0][0].root.title).toBe('新问题');
    expect(failed).not.toHaveBeenCalled();
  });
  test('closing discards delivery, reopening shares the pending call and then five-minute cache', async () => {
    let finish!: (tree: RelatedTree) => void;
    const load = jest.fn(
      () =>
        new Promise<RelatedTree>((resolve) => {
          finish = resolve;
        }),
    );
    let now = 1000;
    const requests = new RelatedRequests(load, () => now);
    const input = { query: '测试问题' };
    const a = requests.get(input),
      ready = jest.fn();
    const close = observeRelated(a, ready, jest.fn());
    close();
    const b = requests.get(input);
    expect(a).toBe(b);
    finish(tree('测试问题'));
    await a;
    expect(ready).not.toHaveBeenCalled();
    expect((await requests.get(input)).cached).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    now += 300001;
    load.mockResolvedValue(tree('测试问题'));
    await requests.get(input);
    expect(load).toHaveBeenCalledTimes(2);
  });
  test('rejected requests are not cached and retry makes a new request', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValue(tree('测试问题'));
    const requests = new RelatedRequests(load);
    await expect(requests.get({ query: '测试问题' })).rejects.toThrow('failed');
    await expect(requests.get({ query: '测试问题' })).resolves.toHaveProperty(
      'root.title',
      '测试问题',
    );
    expect(load).toHaveBeenCalledTimes(2);
  });
  test('wire validation rejects error objects, fake source routes and unknown response shape', () => {
    expect(relatedTreeSchema.safeParse({ error: '503' }).success).toBe(false);
    expect(relatedTreeSchema.safeParse(tree('测试问题')).success).toBe(true);
    expect(
      relatedTreeSchema.safeParse({
        ...tree('测试问题'),
        questions: [
          {
            kind: 'question',
            questionId: '123',
            title: '测试',
            url: 'javascript:alert(1)',
            answers: [],
          },
        ],
      }).success,
    ).toBe(false);
  });
  test.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate'],
    [503, 'service'],
    [400, 'input'],
    [undefined, 'network'],
  ])('UI distinguishes status %s as %s', (status, kind) => {
    expect(relatedErrorKind({ response: { status } })).toBe(kind);
  });
});
