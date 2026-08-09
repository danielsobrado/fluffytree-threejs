import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageConfig = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('verified Pages deploy includes static and browser stress gates', () => {
  const verify = packageConfig.scripts.verify;

  assert.match(verify, /npm run qa:stress(?:\s|$)/);
  assert.match(verify, /npm run qa:stress:render(?:\s|$)/);
  assert.match(packageConfig.scripts['deploy:pages'], /^npm run verify && /);
});
