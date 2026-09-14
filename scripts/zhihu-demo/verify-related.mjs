// Real CLI / hosted API verification. Raw sources must stay outside Git.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});
const {
  buildRelatedTree,
  relatedRequestSchema,
  parseRelatedUrl,
} = require('../../shared/related-tree.ts');
const {
  normalizeItems,
  upstreamSchema,
} = require('../../server/modules/zhilu/search-utils.ts');

function validate(tree) {
  assert.equal(tree.relation, '搜索相关');
  assert.ok(
    tree.questions.length + tree.articles.length > 0,
    'Expected real nonempty search evidence',
  );
  assert.ok(tree.fetchedAt && Number.isFinite(Date.parse(tree.fetchedAt)));
  const seen = new Set();
  for (const q of tree.questions) {
    assert.ok(!seen.has(q.questionId), 'Duplicate question');
    seen.add(q.questionId);
    assert.equal(parseRelatedUrl(q.url)?.questionId, q.questionId);
    for (const a of q.answers) {
      const source = parseRelatedUrl(a.url);
      assert.equal(a.coverage, '搜索片段');
      assert.equal(source?.questionId, q.questionId);
      assert.equal(source?.contentId, a.answerId);
      assert.ok(a.author && a.excerpt);
    }
  }
  for (const a of tree.articles) {
    assert.equal(parseRelatedUrl(a.url)?.kind, 'article');
    assert.equal(a.coverage, '搜索片段');
    assert.equal(a.questionId, undefined);
  }
}
const query = '有了 AI 以后，普通人还有必要花时间学习编程吗？';
const [mode, argument] = process.argv.slice(2);
if (mode === '--reject-invalid-input') {
  relatedRequestSchema.parse({ query: '', questionId: 'demo-id' });
  process.exit(0);
}
if (mode === '--reject-failed-response') {
  validate({ error: { code: 'SERVICE_UNAVAILABLE' } });
  process.exit(0);
}
let tree;
if (mode === '--upstream-file') {
  const upstream = upstreamSchema.parse(
    JSON.parse(readFileSync(argument, 'utf8')),
  );
  assert.equal(upstream.Code, 0, 'Upstream failure must fail verification');
  tree = buildRelatedTree(
    { query },
    {
      items: normalizeItems(upstream),
      cached: false,
      fetchedAt: new Date().toISOString(),
    },
  );
} else if (mode === '--online') {
  const base = new URL(argument);
  assert.equal(base.protocol, 'https:');
  assert.equal(base.hostname, 'ucne7375gmu5.feishuapp.com');
  assert.equal(base.pathname.replace(/\/$/, ''), '/app/app_17dut1cfq4a');
  const post = (data) =>
    fetch(`${argument.replace(/\/$/, '')}/api/zhilu/related`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'suda-csrf-token=related-smoke',
        'X-Suda-Csrf-Token': 'related-smoke',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(25000),
    });
  const invalid = await post({ query: '', questionId: 'demo-id' });
  assert.equal(
    invalid.status,
    400,
    'Invalid input must be rejected by hosted endpoint',
  );
  const response = await post({ query });
  assert.equal(
    response.status,
    200,
    'Real search must succeed; 503 is not empty',
  );
  tree = await response.json();
  validate(tree);
  const cached = await post({ query });
  assert.equal(cached.status, 200);
  assert.equal(
    (await cached.json()).cached,
    true,
    'Second request must use cache',
  );
} else {
  throw new Error(
    'Use --upstream-file <external JSON> or --online <fixed group6 URL>',
  );
}
validate(tree);
console.log(
  JSON.stringify(
    {
      status: 'passed',
      mode,
      questions: tree.questions.length,
      answers: tree.questions.reduce((sum, q) => sum + q.answers.length, 0),
      articles: tree.articles.length,
      sourceIdentity: 'verified',
      coverage: '搜索片段',
      hostedSearch: mode === '--online',
    },
    null,
    2,
  ),
);
