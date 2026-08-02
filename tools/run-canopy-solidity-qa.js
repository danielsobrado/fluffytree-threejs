import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const outputDirectory =
  process.env.CANOPY_SOLIDITY_OUTPUT ?? 'qa-results/canopy-solidity';

const child = spawn(process.execPath, ['tools/run-render-smoke.js'], {
  env: {
    ...process.env,
    RENDER_SMOKE_QA_MODE: 'solidity',
    RENDER_SMOKE_OUTPUT: outputDirectory,
  },
  stdio: 'inherit',
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('close', resolve);
});

const reportPath = path.resolve(outputDirectory, 'canopy-solidity.json');

function writeWorstViewImage(tree) {
  const dataUrl = tree.worstView?.image;
  if (!dataUrl) return null;

  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const file = path.resolve(
    outputDirectory,
    `worst-${tree.presetId}-${tree.worstView.name}.png`,
  );
  fs.writeFileSync(file, Buffer.from(encoded, 'base64'));
  tree.worstView.image = path.basename(file);
  return file;
}

if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const images = report.trees.map(writeWorstViewImage).filter(Boolean);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const tree of report.trees) {
    const crown = tree.views.filter((view) => view.group === 'crown');
    const base = tree.views.filter((view) => view.group === 'base');
    const worst = (views, metric) =>
      views.length === 0 ? 0 : Math.max(...views.map((view) => view[metric]));
    console.log(
      `${tree.presetId.padEnd(16)} trunkClosed=${tree.trunkClosed} ` +
        `crown hole=${worst(crown, 'holeRatio').toFixed(5)} ` +
        `largest=${worst(crown, 'largestHoleRatio').toFixed(5)} | ` +
        `base hole=${worst(base, 'holeRatio').toFixed(5)} ` +
        `largest=${worst(base, 'largestHoleRatio').toFixed(5)}`,
    );
  }

  for (const failure of report.failures ?? []) console.log(`  fail: ${failure}`);
  console.log(`Report: ${reportPath}`);
  for (const image of images) console.log(`Worst view: ${image}`);
}

process.exitCode = exitCode ?? 1;
