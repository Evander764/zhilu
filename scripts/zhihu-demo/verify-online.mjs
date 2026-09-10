// Public runtime smoke check. No authentication credentials or user records.
import assert from 'node:assert/strict';
const base = process.argv[2];
if (!base?.startsWith('https://'))
  throw new Error('Pass the HTTPS application URL');
const headers = {
  Cookie: 'suda-csrf-token=demo-smoke',
  'X-Suda-Csrf-Token': 'demo-smoke',
};
const get = (path, options = {}) =>
  fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
const home = await get('/');
assert.equal(home.status, 200);
const articles = await get('/api/zhihu-demo/articles');
assert.equal(articles.status, 200);
const catalog = await articles.json();
assert.equal(catalog.contentMode, 'original-demo');
assert.ok(catalog.items.length >= 6);
const me = await get('/api/zhihu-demo/me');
assert.equal(me.status, 200);
assert.deepEqual(
  await me.json(),
  { account: null },
  'Anonymous response must remain structured JSON',
);
assert.ok(me.headers.get('cache-control')?.includes('no-store'));
const blocked = [];
for (const [path, method] of [
  ['/me/export', 'GET'],
  ['/me/profile', 'PUT'],
  ['/me/history', 'DELETE'],
  ['/me/activity/bookmark/learning-with-ai', 'PUT'],
  ['/me/activity/bookmark/learning-with-ai', 'DELETE'],
]) {
  const response = await get(`/api/zhihu-demo${path}`, { method });
  assert.equal(
    response.status,
    401,
    `${method} ${path} must reject anonymous callers`,
  );
  blocked.push(`${method} ${path}`);
}
console.log(
  JSON.stringify(
    {
      status: 'passed',
      home: home.status,
      articles: catalog.items.length,
      anonymousAccount: 'null',
      privateCache: 'no-store',
      rejectedAnonymousEndpoints: blocked,
    },
    null,
    2,
  ),
);
