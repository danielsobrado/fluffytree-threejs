import fs from 'node:fs';
import { load } from 'js-yaml';
import { createStressSceneConfig } from '../src/app/stress-scene.js';
import { createTreePresetMap } from '../src/domain/tree-preset.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { analyzeTreeLodBudgets } from '../src/qa/tree-lod-budget-analyzer.js';
import {
  BILLBOARD_BATCH_CAPACITY,
  BILLBOARD_TEXTURE_SIZE,
  createBillboardAtlasLayout,
} from '../src/rendering/tree-billboard-atlas.js';

const scene = createStressSceneConfig(
  load(fs.readFileSync('config/scene.yaml', 'utf8')),
);
const presets = createTreePresetMap(
  load(fs.readFileSync('config/tree-presets.yaml', 'utf8')),
);
const generator = new TreeGenerator();
const viewportHeight = 720;
const focalPixels =
  viewportHeight /
  (2 * Math.tan((scene.camera.fieldOfView * Math.PI) / 360));
const lodCounts = [0, 0, 0, 0];
const farPresets = new Set();
const treeCountsByPreset = new Map();
let estimatedGpuBytes = 0;

for (const entry of scene.layout) {
  const preset = presets.get(entry.preset);
  const tree = generator.generate(preset, entry.seed);
  treeCountsByPreset.set(
    entry.preset,
    (treeCountsByPreset.get(entry.preset) ?? 0) + 1,
  );
  const dx = entry.position[0] - scene.camera.position[0];
  const dy = entry.position[1] - scene.camera.position[1];
  const dz = entry.position[2] - scene.camera.position[2];
  const distance = Math.hypot(dx, dy, dz);
  const pixels = (tree.height / distance) * focalPixels;
  const level =
    pixels >= scene.lod.nearPixels ? 0 :
      pixels >= scene.lod.mediumPixels ? 1 :
        pixels >= scene.lod.farPixels ? 2 : 3;
  lodCounts[level] += 1;
  if (level === 3) farPresets.add(entry.preset);
  const metrics = analyzeTreeLodBudgets(tree);
  const triangles = level === 3 ? 2 : metrics.lodTriangles[level];
  estimatedGpuBytes += triangles * 3 * 32;
}

const atlasLayout = createBillboardAtlasLayout(BILLBOARD_BATCH_CAPACITY);
const atlasBytes =
  atlasLayout.columns *
  atlasLayout.rows *
  BILLBOARD_TEXTURE_SIZE *
  BILLBOARD_TEXTURE_SIZE *
  4;
const atlasBatchCount = [...treeCountsByPreset.values()].reduce(
  (total, count) => total + Math.ceil(count / BILLBOARD_BATCH_CAPACITY),
  0,
);
estimatedGpuBytes += atlasBatchCount * atlasBytes;

const colorDrawCalls =
  1 +
  lodCounts[0] * 4 +
  lodCounts[1] * 3 +
  lodCounts[2] * 2 +
  farPresets.size;
const report = {
  viewport: [1280, 720],
  treeCount: scene.layout.length,
  lodCounts,
  farPresetBatches: farPresets.size,
  atlasBatchCount,
  estimatedColorDrawCalls: colorDrawCalls,
  estimatedGpuMegabytes: Number((estimatedGpuBytes / 1024 / 1024).toFixed(2)),
  budgets: {
    maximumColorDrawCalls: 100,
    maximumGpuMegabytes: 128,
    targetFps: 30,
    fpsRequiresTargetHardware: true,
  },
};
const passed =
  report.treeCount === 75 &&
  report.estimatedColorDrawCalls <= report.budgets.maximumColorDrawCalls &&
  report.estimatedGpuMegabytes <= report.budgets.maximumGpuMegabytes;

fs.mkdirSync('qa-results/tree-stress', { recursive: true });
fs.writeFileSync(
  'qa-results/tree-stress/report.json',
  `${JSON.stringify({ passed, ...report }, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
