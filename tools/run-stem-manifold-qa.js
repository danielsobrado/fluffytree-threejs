import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

process.env.RENDER_SMOKE_QA_MODE = 'manifold';
process.env.RENDER_SMOKE_OUTPUT ??= 'qa-results/stem-manifold';
fs.rmSync(
  path.resolve(process.env.RENDER_SMOKE_OUTPUT, 'stem-manifold.json'),
  { force: true },
);
await import('./run-render-smoke.js');
