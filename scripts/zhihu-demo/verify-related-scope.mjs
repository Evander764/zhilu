// Compare against the coordinator's external immutable baseline, never rewrite it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const baseline = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [path, expected] of Object.entries(baseline.frozenFiles)) {
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  assert.equal(hash, expected, `Frozen file changed: ${path}`);
}
const git = args => execFileSync('git', args, { encoding: 'utf8' });
const changes = [...new Set([
  ...git(['diff', '--name-only', baseline.head]).trim().split('\n'),
  ...git(['ls-files', '--others', '--exclude-standard']).trim().split('\n'),
].filter(Boolean))];
const allowed = /^(client\/src\/pages\/ZhihuDemoPage\/|client\/src\/(app\.tsx|api\/index\.ts)$|shared\/(api\.interface\.ts|related-[^/]+\.ts)$|server\/modules\/(zhilu|zhihu-demo)\/|test\/unit\/[^/]*related[^/]*|scripts\/zhihu-demo\/[^/]*related[^/]*|docs\/question-sidebar-tree\/)/;
for (const path of changes) assert.ok(allowed.test(path), `Out of scope: ${path}`);
for (const path of ['client/src/pages/ZhihuDemoPage/use-demo-account.ts', 'client/src/pages/ZhihuDemoPage/DemoSettings.tsx', 'client/src/pages/ZhihuDemoPage/zhihu-demo.css', 'client/src/app.tsx']) {
  assert.equal(readFileSync(path, 'utf8'), git(['show', `${baseline.head}:${path}`]), `Protected layout/account/routes changed: ${path}`);
}
const page = 'client/src/pages/ZhihuDemoPage/ZhihuDemoPage.tsx';
const prose = source => source.match(/<article className="zd-answer zd-panel">[\s\S]*?<\/article>/)?.[0];
assert.ok(prose(readFileSync(page, 'utf8')));
assert.equal(prose(readFileSync(page, 'utf8')), prose(git(['show', `${baseline.head}:${page}`])), 'Original answer rendering must stay byte-identical');
console.log(JSON.stringify({ status: 'passed', frozenFiles: Object.keys(baseline.frozenFiles).length, originalAnswerMarkup: 'identical', originalLayoutCss: 'identical', accountAndRoutes: 'identical', changedFiles: changes.length }, null, 2));
