import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const source = readFileSync(
  new URL('./verify-related.mjs', import.meta.url),
  'utf8',
);
const cwd = fileURLToPath(new URL('.', import.meta.url));
for (const [flag, gate] of [
  [
    '--reject-invalid-input',
    "relatedRequestSchema.parse({ query: '', questionId: 'demo-id' });",
  ],
  [
    '--reject-failed-response',
    "validate({ error: { code: 'SERVICE_UNAVAILABLE' } });",
  ],
]) {
  assert.ok(source.includes(gate), 'Mutation must match exactly');
  const run = (code) =>
    spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', code, '--', 'sensitivity', flag],
      { cwd, encoding: 'utf8' },
    );
  const intact = run(source);
  assert.equal(intact.status, 1, `${flag}: intact gate must reject`);
  assert.match(
    intact.stderr,
    /ZodError|AssertionError/,
    'Failure must originate in validation',
  );
  const broken = run(
    source.replace(gate, '/* deliberately removed validation */'),
  );
  assert.equal(
    broken.status,
    0,
    `${flag}: bypass must be accepted, exposing broken gate`,
  );
  console.log(
    `${flag}: intact exit=1; validation removed exit=0; sensitivity detected`,
  );
}
console.log(
  'passed: both checks distinguish validation from unconditional failure',
);
