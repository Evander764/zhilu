import {
  buildRelatedTree,
  parseRelatedUrl,
  relatedRequestSchema,
} from '../../shared/related-tree';
import {
  normalizeItems,
  upstreamSchema,
} from '../../server/modules/zhilu/search-utils';

const answer = (questionId: string, answerId: string) => ({
  title: '测试问题',
  author: '测试作者',
  excerpt: '搜索返回的片段',
  url: `https://www.zhihu.com/question/${questionId}/answer/${answerId}`,
  contentType: 'Answer',
  contentId: answerId,
});
const result = (items: ReturnType<typeof answer>[]) => ({
  items,
  cached: false,
  fetchedAt: '2026-09-14T16:00:00.000Z',
});
describe('related tree preserves source identity', () => {
  test('deduplicates answer IDs across tracking URLs and groups multiple answers per real question', () => {
    const a = answer('100', '200');
    const tree = buildRelatedTree(
      { query: '测试问题' },
      result([
        a,
        { ...a, url: `${a.url}?utm_source=source` },
        answer('100', '201'),
        answer('101', '202'),
      ]),
    );
    expect(tree.root.questionId).toBeNull();
    expect(tree.questions.map((q) => q.questionId)).toEqual(['100', '101']);
    expect(tree.questions[0].answers.map((a) => a.answerId)).toEqual([
      '200',
      '201',
    ]);
    expect(tree.questions[0].answers[0]).toMatchObject({
      author: '测试作者',
      excerpt: '搜索返回的片段',
      coverage: '搜索片段',
    });
  });
  test('keeps articles in supplemental reading without invented question IDs', () => {
    const item = {
      ...answer('100', '200'),
      url: 'https://zhuanlan.zhihu.com/p/300?utm_source=source',
      contentType: 'Article',
      contentId: '300',
    };
    const tree = buildRelatedTree(
      { query: '测试问题', questionId: '100' },
      result([item]),
    );
    expect(tree.questions).toEqual([]);
    expect(tree.articles).toHaveLength(1);
    expect(tree.articles[0]).not.toHaveProperty('questionId');
    expect(tree.articles[0].url).toBe(item.url);
  });
  test('uses question source when present and never calls an answer author the question author', () => {
    const tree = buildRelatedTree(
      { query: '测试问题' },
      result([
        answer('100', '200'),
        {
          ...answer('100', '100'),
          contentType: 'Question',
          url: 'https://www.zhihu.com/question/100',
        },
      ]),
    );
    expect(tree.questions).toHaveLength(1);
    expect(tree.questions[0].source?.coverage).toBe('搜索片段');
    expect(tree.questions[0]).not.toHaveProperty('author');
  });
  test('uses canonical URL IDs, preserves opaque upstream IDs and rejects conflicting types', () => {
    const tree = buildRelatedTree(
      { query: '测试问题' },
      result([
        { ...answer('100', '200'), contentType: '', contentId: '' },
        { ...answer('101', '201'), contentType: 'Article' },
        { ...answer('102', '202'), contentId: '-999' },
      ]),
    );
    expect(tree.questions.map((q) => q.questionId)).toEqual(['100', '102']);
    expect(tree.questions[1].answers[0]).toMatchObject({
      answerId: '202',
      upstreamContentId: '-999',
    });
  });
  test('caps upstream items at ten and bounds display fields', () => {
    const tree = buildRelatedTree(
      { query: '测试问题' },
      result(
        Array.from({ length: 15 }, (_, i) => ({
          ...answer('100', String(i + 1)),
          excerpt: '文'.repeat(1000),
        })),
      ),
    );
    expect(tree.questions[0].answers).toHaveLength(10);
    expect(tree.questions[0].answers[0].excerpt).toHaveLength(600);
  });
  test('successful empty results remain empty', () => {
    expect(buildRelatedTree({ query: '测试问题' }, result([]))).toMatchObject({
      questions: [],
      articles: [],
      relation: '搜索相关',
    });
  });
  test('normalization retains official type and ID and strips markup', () => {
    const raw = {
      Code: 0,
      Data: {
        Items: [
          {
            Title: '<b>标题</b>',
            AuthorName: '作者',
            ContentText: '<i>片段</i>',
            Url: answer('100', '200').url,
            ContentType: 'Answer',
            ContentID: '200',
          },
        ],
      },
    };
    expect(normalizeItems(upstreamSchema.parse(raw))[0]).toMatchObject({
      title: '标题',
      excerpt: '片段',
      contentType: 'Answer',
      contentId: '200',
    });
  });
  test.each([
    'javascript:alert(1)',
    'http://www.zhihu.com/question/1',
    'https://zhihu.com.evil.test/question/1',
    'https://user:pass@www.zhihu.com/question/1',
    'https://www.zhihu.com:444/question/1',
    'https://www.zhihu.com/redirect?target=https://evil.test',
    'https://zhuanlan.zhihu.com/question/1',
    'https://www.zhihu.com/question/../people/1',
    'https://www.zhihu.com/question/%31',
    'https://www.zhihu.com/question/1\\evil',
    'https://www.zhihu.com/question/1\n',
    `https://www.zhihu.com/question/1?x=${'x'.repeat(2048)}`,
  ])('rejects unsafe link %s', (url) =>
    expect(parseRelatedUrl(url)).toBeNull(),
  );
  test.each([
    { query: '' },
    { query: 'x' },
    { query: 'x'.repeat(121) },
    { query: {} },
    { query: '测试\u0000问题' },
    { query: '测试\u202e问题' },
    { query: '测试问题', questionId: 'learning-with-ai' },
    { query: '测试问题', questionId: '1/answer/2' },
    { query: '测试问题', nodeId: 'old-catalog' },
  ])('rejects invalid related request %#', (input) =>
    expect(relatedRequestSchema.safeParse(input).success).toBe(false),
  );
});
