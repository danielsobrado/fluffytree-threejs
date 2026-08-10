import fs from 'node:fs';
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
import { readYamlConfigSync } from './node-yaml-config.js';

const VISIBLE_FADE_THRESHOLD = 0.001;
const VIEWPORT = Object.freeze([1280, 720]);

function requirePositiveFinite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a finite number > 0.`);
  }
  return value;
}

function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a positive integer.`);
  }
  return value;
}

function loadStressPolicy() {
  const config = readYamlConfigSync('config/tree-stress-qa.yaml');
  if (typeof config.fpsRequiresTargetHardware !== 'boolean') {
    throw new Error(
      "Configuration 'tree-stress-qa.fpsRequiresTargetHardware' must be a boolean.",
    );
  }

  return Object.freeze({
    expectedTreeCount: requirePositiveInteger(
      config.expectedTreeCount,
      'tree-stress-qa.expectedTreeCount',
    ),
    maximumColorDrawCalls: requirePositiveInteger(
      config.maximumColorDrawCalls,
      'tree-stress-qa.maximumColorDrawCalls',
    ),
    maximumGpuMegabytes: requirePositiveFinite(
      config.maximumGpuMegabytes,
      'tree-stress-qa.maximumGpuMegabytes',
    ),
    targetFps: requirePositiveFinite(
      config.targetFps,
      'tree-stress-qa.targetFps',
    ),
    fpsRequiresTargetHardware: config.fpsRequiresTargetHardware,
  });
}

const baseScene = validateSceneConfig(readYamlConfigSync('config/scene.yaml'));
const scene = validateSceneConfig(createStressSceneConfig(baseScene));
const treeConfig = readYamlConfigSync('config/tree-presets.yaml');
const continuityConfig = readYamlConfigSync('config/foliage-continuity.yaml');
const presets = PresetLibrary.fromConfig(treeConfig, continuityConfig).presets;
const policy = loadStressPolicy();
const generator = new TreeGenerator();
const viewportHeight = VIEWPORT[1];
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
  viewport: VIEWPORT,
  treeCount: scene.layout.length,
  visibleLodCounts,
  farPresetBatches: farBatchCount,
  atlasBatchCount,
  estimatedColorDrawCalls: colorDrawCalls,
  estimatedGpuMegabytes: Number((estimatedGpuBytes / 1024 / 1024).toFixed(2)),
  budgets: {
    maximumColorDrawCalls: policy.maximumColorDrawCalls,
    maximumGpuMegabytes: policy.maximumGpuMegabytes,
    targetFps: policy.targetFps,
    fpsRequiresTargetHardware: policy.fpsRequiresTargetHardware,
  },
};
const passed =
  report.treeCount === policy.expectedTreeCount &&
  report.estimatedColorDrawCalls <= policy.maximumColorDrawCalls &&
  report.estimatedGpuMegabytes <= policy.maximumGpuMegabytes;

fs.mkdirSync('qa-results/tree-stress', { recursive: true });
fs.writeFileSync(
  'qa-results/tree-stress/report.json',
  `${JSON.stringify({ passed, ...report }, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
