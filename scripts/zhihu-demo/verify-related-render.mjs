// Render the actual components in memory. This is not a browser or visual acceptance.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    jsx: 'react-jsx',
  },
});
const { createElement: h } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
const {
  RelatedTreeView,
} = require('../../client/src/pages/ZhihuDemoPage/RelatedTreeView.tsx');
const {
  RelatedReading,
} = require('../../client/src/pages/ZhihuDemoPage/RelatedReading.tsx');
const {
  buildRelatedTree,
  relatedQuestionPath,
  relatedRouteRequest,
} = require('../../shared/related-tree.ts');
const current = { query: '测试用当前问题' };
const tree = buildRelatedTree(current, {
  items: [
    {
      title: '测试用下一问题',
      author: '测试作者',
      excerpt: '测试片段，不是生产数据',
      url: 'https://www.zhihu.com/question/123/answer/456',
      contentType: 'Answer',
    },
  ],
  cached: false,
  fetchedAt: new Date().toISOString(),
});
const render = (element) =>
  renderToStaticMarkup(h(StaticRouter, { location: '/' }, element));
const treeView = (state) =>
  render(
    h(RelatedTreeView, { current, state, retry: () => {}, onSelect: () => {} }),
  );
const html = treeView({ status: 'ready', tree });
assert.ok(html.includes('aria-current="page"'));
assert.ok(html.includes(relatedQuestionPath(tree.questions[0])));
assert.match(html, /<details[^>]*>/);
assert.match(html, /<summary>.*测试作者/);
assert.ok(html.includes('https://www.zhihu.com/question/123/answer/456'));
assert.match(html, /target="_blank" rel="noopener noreferrer"/);
assert.ok(html.includes('搜索片段'));
const nextUrl = new URL(
  relatedQuestionPath(tree.questions[0]),
  'https://example.test',
);
assert.deepEqual(
  relatedRouteRequest('123', nextUrl.searchParams.get('title')),
  { query: '测试用下一问题', questionId: '123' },
);
for (const error of ['auth', 'rate', 'service', 'network', 'input']) {
  const html = treeView({ status: 'error', error });
  assert.match(html, /role="alert"/);
  assert.ok(!html.includes('没有找到相关问题'));
  assert.ok(html.includes('重试搜索'));
}
assert.match(treeView({ status: 'loading' }), /正在检索相关问题/);
assert.match(
  treeView({ status: 'ready', tree: { ...tree, questions: [] } }),
  /没有找到相关问题或文章/,
);
const reading = render(
  h(RelatedReading, {
    current: { query: '测试用下一问题', questionId: '123' },
    title: '测试用下一问题',
    state: { status: 'loading' },
    sidebar: null,
  }),
);
assert.ok(reading.includes('正在检索这个问题的回答片段'));
assert.ok(!reading.includes('本次未取得'));
assert.ok(!reading.includes('示例回答'));
console.log(
  JSON.stringify(
    {
      status: 'passed',
      surface: 'actual React components rendered in memory',
      checks: [
        'question link -> next query',
        'answer disclosure/source link',
        'current node',
        'five distinct error states',
        'empty state',
        'cold-open loading state',
      ],
      browserAcceptance: false,
    },
    null,
    2,
  ),
);
