// Public release check: no user login, no OAuth request, no personal data.
import assert from 'node:assert/strict';
const base = 'https://ucne7375gmu5.feishuapp.com/app/app_17dut1cfq4a';
const headers = { Cookie: 'suda-csrf-token=oauth-release-check', 'X-Suda-Csrf-Token': 'oauth-release-check' };
const get = (path, options = {}) => fetch(base + path, {
  ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(20000),
});
const response = await get('/api/zhihu-oauth/status');
assert.equal(response.status, 200);
assert.match(response.headers.get('cache-control'), /no-store/);
const status = await response.json();
assert.equal(status.version, 'miaoda-zhihu-oauth-661-v1');
assert.equal(status.appId, '661');
assert.equal(status.configured, true);
assert.equal(status.signedIn, false);
assert.equal(status.redirectUri, base + '/auth/zhihu/callback');
assert.equal(status.ready, status.callbackRegistered);
for (const path of ['/settings/account', '/auth/zhihu/callback']) {
  const page = await get(path);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text();
  assert.match(html, /name="referrer" content="no-referrer"/);
  if (process.argv[2]) assert.ok(html.includes(process.argv[2]), 'Page must be the released commit');
}
for (const path of ['/start', '/complete']) {
  const denied = await get('/api/zhihu-oauth' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(denied.status, 401, 'Anonymous requests must not begin OAuth or read data');
}
console.log(JSON.stringify({
  status: 'passed', appId: status.appId, version: status.version,
  configured: status.configured, callbackRegistered: status.callbackRegistered,
  redirectUri: status.redirectUri, anonymousRejected: true,
  commit: process.argv[2] || null, realOAuthVerified: false,
}, null, 2));
