import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('every declared cache policy refuses host payload transformation', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const policies = headers.split('\n').filter(line => line.includes('Cache-Control:'));
  assert(policies.length >= 4);
  for (const policy of policies) assert.match(policy, /\bno-transform\b/);
});
