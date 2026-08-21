import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SMOKE_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'run-render-smoke.js');

const child = spawn(process.execPath, [SMOKE_SCRIPT], {
  env: {
    ...process.env,
    RENDER_SMOKE_QA_MODE: 'stress',
    RENDER_SMOKE_OUTPUT: 'qa-results/stress-smoke',
  },
  stdio: 'inherit',
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('close', resolve);
});
process.exitCode = exitCode ?? 1;
