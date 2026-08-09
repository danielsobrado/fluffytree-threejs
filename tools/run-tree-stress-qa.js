import fs from 'node:fs';
import { load } from 'js-yaml';
import { createStressSceneConfig } from '../src/app/stress-scene.js';
import { validateSceneConfig } from '../src/config/scene-config-validator.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { analyzeTreeLodBudgets } from '../src/qa/tree-lod-budget-analyzer.js';
import {
  BILLBOARD_BATCH_CAPACITY,
  BILLBOARD_TEXTURE_SIZE,
  createBillboardAtlasLayout,
} from '../src/rendering/tree-billboard-atlas.js';
import {
  calculateLodWeights,
  remapUnavailableLodWeights,
} from '../src/rendering/tree-lod-math.js';

const VISIBLE_FADE_THRESHOLD = 0.001;
const baseScene = validateSceneConfig(
  load(fs.readFileSync('config/scene.yaml', 'utf8')),
);
const scene = validateSceneConfig(createStressSceneConfig(baseScene));
const treeConfig = load(fs.readFileSync('config/tree-presets.yaml', 'utf8'));
const continuityConfig = load(
  fs.readFileSync('config/foliage-continuity.yaml', 'utf8'),
);
const presets = PresetLibrary.fromConfig(treeConfig, continuityConfig).presets;
const generator = new TreeGenerator();
const viewportHeight = 720;
const focalPixels =
  viewportHeight /
  (2 * Math.tan((scene.camera.fieldOfView * Math.PI) / 360));
const visibleLodCounts = [0, 0, 0, 0];
const activeFarBatches = new Set();
const treeCountsByPreset = new Map();
let estimatedGpuBytes = 0;

function minimumLod(entry) {
  return Number(entry.position[2]) <= -160 ? 3 : 2;
}

for (const entry of scene.layout) {
  const preset = presets.get(entry.preset);
  if (!preset) {
    throw new Error(`Stress layout references unknown preset '${entry.preset}'.`);
  }

  const presetTreeIndex = treeCountsByPreset.get(entry.preset) ?? 0;
  treeCountsByPreset.set(entry.preset, presetTreeIndex + 1);
  const tree = generator.generate(preset, entry.seed);
  const dx = entry.position[0] - scene.camera.position[0];
  const dy = entry.position[1] - scene.camera.position[1];
  const dz = entry.position[2] - scene.camera.position[2];
  const distance = Math.max(0.001, Math.hypot(dx, dy, dz));
  const pixels = (tree.height / distance) * focalPixels;
  const minimumLevel = minimumLod(entry);
  const weights = remapUnavailableLodWeights(
    calculateLodWeights(pixels, scene.lod),
    { minimumLevel, heroReady: false },
  );

  for (let level = 0; level < weights.length; level += 1) {
    if (weights[level] > VISIBLE_FADE_THRESHOLD) visibleLodCounts[level] += 1;
  }
  if (weights[3] > VISIBLE_FADE_THRESHOLD) {
    activeFarBatches.add(
      `${entry.preset}:${Math.floor(presetTreeIndex / BILLBOARD_BATCH_CAPACITY)}`,
    );
  }

  const metrics = analyzeTreeLodBudgets(tree);
  for (let level = minimumLevel; level <= 2; level += 1) {
    estimatedGpuBytes += metrics.lodTriangles[level] * 3 * 32;
  }
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
const farBatchCount = activeFarBatches.size;
estimatedGpuBytes += atlasBatchCount * atlasBytes;

const colorDrawCalls =
  1 +
  visibleLodCounts[0] * 4 +
  visibleLodCounts[1] * 3 +
  visibleLodCounts[2] * 2 +
  farBatchCount;
const report = {
  viewport: [1280, 720],
  treeCount: scene.layout.length,
  visibleLodCounts,
  farPresetBatches: farBatchCount,
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
