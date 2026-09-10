import {
  questionIdFromUrl,
  questionsFromSearch,
  type QuestionGraph,
  type PublicQuestion,
  type QuestionLink,
} from '../../shared/question-graph';
import {
  addBranch,
  collapseBranch,
  parseShare,
  restoreShare,
  selectQuestion,
  startExploration,
  startFromSearch,
  toShare,
} from '../../shared/graph-state';
import { QuestionGraphService } from '../../server/modules/zhilu/question-graph.service';
import { ZhiluService } from '../../server/modules/zhilu/zhilu.service';
import type { PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
// Synthetic fixtures are exclusively for tests, never published as content.
const question = (id: string): PublicQuestion => ({
  id,
  title: `Test ${id}`,
  url: `https://www.zhihu.com/question/${id}`,
  origin: 'curated',
  sources: [],
});
const edge = (a: string, b: string): QuestionLink => ({
  id: `${a}-${b}`,
  fromId: a,
  toId: b,
  kind: '展开步骤',
  basis: '编辑整理关系',
  reason: 'test',
  evidence: [],
});
const graph: QuestionGraph = {
  version: 'test',
  updatedAt: '',
  questions: ['1', '2', '3', '4'].map(question),
  links: [
    edge('1', '2'),
    edge('1', '3'),
    edge('2', '4'),
    edge('3', '4'),
    edge('4', '1'),
  ],
  journeys: [
    {
      id: 'test',
      title: 'test',
      description: '',
      questionIds: ['1', '2', '4'],
    },
  ],
};

describe('real question identity', () => {
  test.each([
    'practice',
    'https://zhuanlan.zhihu.com/p/123',
    'https://zhihu.com.evil.com/question/1',
    'https://u:p@zhihu.com/question/1',
    'javascript:alert(1)',
    'https://www.zhihu.com/question/1/answer/not-an-id',
  ])('rejects non-question %s', (url) =>
    expect(questionIdFromUrl(url)).toBeNull(),
  );
  test('same question across answers has stable identity', () =>
    expect(
      questionIdFromUrl(
        'https://www.zhihu.com/question/123/answer/456?utm_source=x',
      ),
    ).toBe('123'));
  test('merges answers and excludes articles', () => {
    const q = questionsFromSearch({
      cached: false,
      fetchedAt: '2026-09-07',
      items: [1, 2, 3].map((i) => ({
        title: '题目',
        author: '作者',
        excerpt: '片段',
        url:
          i === 3
            ? 'https://zhuanlan.zhihu.com/p/3'
            : `https://www.zhihu.com/question/123/answer/${i}`,
      })),
    });
    expect(q).toHaveLength(1);
    expect(q[0].sources).toHaveLength(2);
  });
});
describe('graph navigation and stable space', () => {
  test('expansion preserves positions and merges shared nodes', () => {
    const state = startExploration(graph, '1');
    const next = addBranch(state, '3', [question('4')], [edge('3', '4')]);
    expect(next.positions).toEqual(state.positions);
    expect(next.questions.filter((q) => q.id === '4')).toHaveLength(1);
  });
  test('collapsing one route retains shared node reached by another', () => {
    const state = addBranch(
      startExploration(graph, '1'),
      '3',
      [question('4')],
      [edge('3', '4')],
    );
    const next = collapseBranch(state, '2');
    expect(next.visible).toContain('4');
    expect(next.expanded).not.toContain('2');
  });
  test('cycles terminate and never duplicate questions', () => {
    const state = startExploration(graph, '1');
    const next = addBranch(state, '4', [question('1')], [edge('4', '1')]);
    expect(collapseBranch(next, '3').visible.length).toBeLessThanOrEqual(4);
  });
  test('select and share preserve public order without search text', () => {
    const state = selectQuestion(startExploration(graph, '1'), '2');
    const share = toShare(state);
    expect(Object.keys(share).sort()).toEqual(['ids', 'links', 'path', 'v']);
    expect(restoreShare(share, graph.questions, graph).path).toEqual([
      '1',
      '2',
    ]);
    expect(restoreShare(share, [question('1')], graph).path).toEqual(['1']);
  });
  test.each([
    'garbage',
    '{"v":2,"ids":["1"],"links":[],"path":["2"]}',
    '{"v":2,"ids":["1"],"links":[],"path":["1"],"query":"private"}',
  ])('rejects unsafe share %s', (value) =>
    expect(parseShare(value)).toBeNull(),
  );
  test('incremental expansion caps five results', () => {
    const next = addBranch(
      startExploration(graph, '1'),
      '2',
      Array.from({ length: 10 }, (_, i) => question(String(i + 10))),
      [],
    );
    expect(next.questions.filter((q) => Number(q.id) >= 10)).toHaveLength(5);
  });
});
describe('search index and upstream isolation', () => {
  function setup() {
    const execute = jest.fn().mockResolvedValue([]);
    const search = jest.fn();
    const service = new QuestionGraphService(
      { execute } as unknown as PostgresJsDatabase,
      { search } as unknown as ZhiluService,
    );
    jest.spyOn(service, 'graph').mockResolvedValue(graph);
    return { service, search, execute };
  }
  test('real search shape is indexed before response', async () => {
    const { service, search, execute } = setup();
    search.mockResolvedValue({
      cached: false,
      fetchedAt: '2026-09-07',
      items: [
        {
          title: '问题',
          author: '作者',
          excerpt: '内容',
          url: 'https://www.zhihu.com/question/55/answer/66',
        },
      ],
    });
    expect((await service.search({ query: '测试' })).questions[0].id).toBe(
      '55',
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
  test('empty result does not fabricate questions', async () => {
    const { service, search, execute } = setup();
    search.mockResolvedValue({
      cached: false,
      fetchedAt: '2026-09-07',
      items: [],
    });
    expect((await service.search({ query: '测试' })).questions).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
  test('storage failure returns safe error', async () => {
    const { service, search, execute } = setup();
    search.mockResolvedValue({
      cached: false,
      fetchedAt: '2026-09-07',
      items: [
        {
          title: '问题',
          author: '作者',
          excerpt: '内容',
          url: 'https://www.zhihu.com/question/55/answer/66',
        },
      ],
    });
    execute.mockRejectedValue(new Error('private'));
    await expect(service.search({ query: '测试' })).rejects.toMatchObject({
      status: 503,
    });
  });
  test('missing context cannot query arbitrary IDs', async () => {
    const { service, search } = setup();
    await expect(service.expand('not-real', {})).rejects.toMatchObject({
      status: 400,
    });
    expect(search).not.toHaveBeenCalled();
  });
});

describe('topic-first entry', () => {
  test.each(['1', '3'])(
    'a chosen search result %s starts alone even with existing curated edges',
    (id) => {
      const next = startFromSearch(question(id));
      expect(next.visible).toEqual([id]);
      expect(next.path).toEqual([id]);
      expect(next.links).toEqual([]);
      expect(next.expanded).toEqual([]);
      expect(startExploration(graph, id).visible.length).toBeGreaterThan(1);
    },
  );
});
