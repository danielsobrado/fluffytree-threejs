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

function maximum(views, metric) {
  return views.length === 0 ? 0 : Math.max(...views.map((view) => view[metric]));
}

function minimum(views, metric) {
  const values = views.map((view) => view[metric]).filter(Number.isFinite);
  return values.length === 0 ? 0 : Math.min(...values);
}

function worstCrownView(views) {
  return [...views].sort(
    (left, right) =>
      right.holeRatio - left.holeRatio ||
      left.coverageRetention - right.coverageRetention,
  )[0];
}

if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const images = report.trees.map(writeWorstViewImage).filter(Boolean);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const tree of report.trees) {
    const crown = tree.views.filter((view) => view.group === 'crown');
    const base = tree.views.filter((view) => view.group === 'base');
    const worst = worstCrownView(crown);
    console.log(
      `${tree.presetId.padEnd(16)} trunkClosed=${tree.trunkClosed} ` +
        `worst=${worst?.lodState ?? 'n/a'} ` +
        `hole=${(worst?.holeRatio ?? 0).toFixed(5)} ` +
        `largest=${(worst?.largestHoleRatio ?? 0).toFixed(5)} ` +
        `retention=${minimum(crown, 'coverageRetention').toFixed(3)} | ` +
        `base hole=${maximum(base, 'holeRatio').toFixed(5)} ` +
        `largest=${maximum(base, 'largestHoleRatio').toFixed(5)}`,
    );
  }

  for (const failure of report.failures ?? []) console.log(`  fail: ${failure}`);
  console.log(`Report: ${reportPath}`);
  for (const image of images) console.log(`Worst view: ${image}`);
}

process.exitCode = exitCode ?? 1;
