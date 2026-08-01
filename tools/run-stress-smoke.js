import { spawn } from 'node:child_process';
import process from 'node:process';

const child = spawn(process.execPath, ['tools/run-render-smoke.js'], {
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
