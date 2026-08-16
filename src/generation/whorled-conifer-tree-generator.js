import { createCrownSummary } from './crown-summary.js';
import { FoliageShellGenerator } from './foliage-shell-generator.js';
import { LobeConnectionAnalyzer } from './lobe-connection-analyzer.js';
import {
  createEmptyFoliageShell,
  createLegacyTreeData,
} from './legacy-tree-data-factory.js';
import { SeededRandom } from './seeded-random.js';
import { createTreeIrFromLegacyTreeData } from './tree-ir-from-legacy-data.js';
import { parseWhorledConiferConfig } from './whorled-conifer-config.js';
import { WHORLED_CONIFER_CONSTANTS } from './whorled-conifer-constants.js';

function lerp(minimum, maximum, ratio) {
  return minimum + (maximum - minimum) * ratio;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerpPoint(start, end, ratio) {
  return {
    x: lerp(start.x, end.x, ratio),
    y: lerp(start.y, end.y, ratio),
    z: lerp(start.z, end.z, ratio),
  };
}

function leaderPoint(preset, config, phase, normalizedHeight) {
  const t = clamp(normalizedHeight, 0, 1);
  const wander =
    Math.sin(t * Math.PI * 2.2 + phase) *
    config.leaderWander *
    preset.crown.radius *
    t *
    t;
  return {
    x: preset.crown.lean[0] * t + Math.cos(phase) * wander,
    y: preset.height * t,
    z: preset.crown.lean[1] * t + Math.sin(phase) * wander,
  };
}

function createLeader(preset, config, random) {
  const phase = random.range(0, Math.PI * 2);
  const points = [];
  for (let index = 0; index <= preset.trunk.segments; index += 1) {
    points.push(
      leaderPoint(preset, config, phase, index / preset.trunk.segments),
    );
  }
  return { phase, points };
}

function trunkRadiusAt(preset, normalizedHeight) {
  return lerp(
    preset.trunk.baseRadius,
    preset.trunk.topRadius,
    Math.pow(clamp(normalizedHeight, 0, 1), preset.trunk.taperPower ?? 1),
  );
}

function createBranchPath(start, angle, length, normalizedCrownHeight, config) {
  const horizontal = {
    x: Math.cos(angle) * length,
    z: Math.sin(angle) * length,
  };
  const upward = length * lerp(0.08, 0.38, normalizedCrownHeight);
  const sag =
    config.branchSag * length * lerp(1, 0.45, normalizedCrownHeight);
  const end = {
    x: start.x + horizontal.x,
    y: start.y + upward - sag,
    z: start.z + horizontal.z,
  };
  const first = lerpPoint(start, end, 0.32);
  first.y += upward * 0.35;
  const second = lerpPoint(start, end, 0.7);
  second.y += upward * 0.1 - sag * 0.2;
  return [start, first, second, end];
}

function createBranchLobe({
  id,
  branchId,
  macroClumpId,
  path,
  angle,
  length,
  normalizedCrownHeight,
  mortality,
  config,
  random,
}) {
  const position = lerpPoint(path[0], path.at(-1), 0.7);
  const mortalityScale = lerp(1, 0.38, mortality);
  const foliageScale = config.foliageScale * mortalityScale;
  const minimum = WHORLED_CONIFER_CONSTANTS.minimumFoliageAxis;
  return {
    id,
    macroClumpId,
    position,
    scale: {
      x: Math.max(minimum, length * 0.34 * foliageScale),
      y: Math.max(minimum, length * 0.13 * foliageScale),
      z: Math.max(minimum, length * 0.18 * foliageScale),
    },
    rotation: {
      x: random.signed() * 0.05,
      y: -angle,
      z: -config.branchSag * 0.2,
    },
    colorMix: clamp(
      0.28 + normalizedCrownHeight * 0.45 + random.signed() * 0.08,
      0,
      1,
    ),
    branchId,
  };
}

function createWhorl({
  preset,
  config,
  random,
  leaderPhase,
  whorlIndex,
  branches,
  lobes,
}) {
  const whorlRatio = whorlIndex / (config.whorlCount - 1);
  const crownRatio = lerp(
    WHORLED_CONIFER_CONSTANTS.lowerWhorlHeightRatio,
    WHORLED_CONIFER_CONSTANTS.upperWhorlHeightRatio,
    whorlRatio,
  );
  const y = preset.crown.baseHeight + preset.crown.height * crownRatio;
  const normalizedHeight = clamp(y / preset.height, 0, 1);
  const start = leaderPoint(preset, config, leaderPhase, normalizedHeight);
  const count = random.integer(
    config.branchesPerWhorl[0],
    config.branchesPerWhorl[1],
  );
  const phase =
    leaderPhase +
    whorlIndex * Math.PI * 2 * config.whorlTwist +
    random.signed() * 0.16;

  for (let branchIndex = 0; branchIndex < count; branchIndex += 1) {
    const angle =
      phase +
      (branchIndex / count) * Math.PI * 2 +
      random.signed() * 0.08;
    const taper = Math.pow(
      Math.max(0.08, 1 - crownRatio * 0.94),
      config.crownTaperPower,
    );
    const variation = 1 + random.signed() * config.branchLengthVariation;
    const ageFactor = lerp(1.08, 0.72, crownRatio);
    const length = Math.max(
      WHORLED_CONIFER_CONSTANTS.minimumBranchLength,
      preset.crown.radius * taper * variation * ageFactor,
    );
    const mortality = clamp(
      config.lowerBranchMortality *
        (1 - crownRatio) ** 1.7 *
        lerp(0.65, 1.35, random.next()),
      0,
      1,
    );
    const path = createBranchPath(start, angle, length, crownRatio, config);
    const branchId = branches.length;
    const lobeId = lobes.length;
    const baseRadius = trunkRadiusAt(preset, normalizedHeight);
    const startRadius = Math.max(
      WHORLED_CONIFER_CONSTANTS.minimumBranchRadius,
      baseRadius *
        WHORLED_CONIFER_CONSTANTS.branchRadiusRatio *
        lerp(1, 0.58, crownRatio),
    );
    const endRadius = Math.max(
      WHORLED_CONIFER_CONSTANTS.minimumBranchTipRadius,
      startRadius * WHORLED_CONIFER_CONSTANTS.branchTipRadiusRatio,
    );

    branches.push({
      id: branchId,
      parentId: null,
      order: 1,
      macroClumpId: whorlIndex,
      targetLobeId: lobeId,
      exposed: true,
      points: path,
      startRadius,
      endRadius,
    });
    lobes.push(
      createBranchLobe({
        id: lobeId,
        branchId,
        macroClumpId: whorlIndex,
        path,
        angle,
        length,
        normalizedCrownHeight: crownRatio,
        mortality,
        config,
        random,
      }),
    );
  }
}

function createApexLobe(preset, config, leaderPhase, id) {
  const position = leaderPoint(preset, config, leaderPhase, 0.94);
  const scale = Math.max(
    WHORLED_CONIFER_CONSTANTS.minimumFoliageAxis,
    preset.crown.radius * WHORLED_CONIFER_CONSTANTS.apexFoliageScale,
  );
  return {
    id,
    macroClumpId: config.whorlCount - 1,
    position,
    scale: { x: scale * 0.7, y: scale * 1.3, z: scale * 0.7 },
    rotation: { x: 0, y: leaderPhase, z: 0 },
    colorMix: 0.78,
    branchId: null,
  };
}

function createStructure(preset, config, random) {
  const leader = createLeader(preset, config, random);
  const branches = [];
  const lobes = [];
  for (let whorlIndex = 0; whorlIndex < config.whorlCount; whorlIndex += 1) {
    createWhorl({
      preset,
      config,
      random,
      leaderPhase: leader.phase,
      whorlIndex,
      branches,
      lobes,
    });
  }
  lobes.push(createApexLobe(preset, config, leader.phase, lobes.length));

  return {
    trunk: {
      points: leader.points,
      startRadius: preset.trunk.baseRadius,
      endRadius: preset.trunk.topRadius,
      flare: preset.trunk.flare,
      taperPower: preset.trunk.taperPower ?? 1,
      nebari: Number(preset.trunk.nebari ?? 1),
      style: preset.trunk.style,
    },
    branches: Object.freeze(branches),
    lobes: Object.freeze(lobes),
  };
}

export class WhorledConiferTreeGenerator {
  constructor({
    foliageShellGenerator = new FoliageShellGenerator(),
    lobeConnectionAnalyzer = new LobeConnectionAnalyzer(),
    lodCostAnalyzer = null,
  } = {}) {
    this.foliageShellGenerator = foliageShellGenerator;
    this.lobeConnectionAnalyzer = lobeConnectionAnalyzer;
    this.lodCostAnalyzer = lodCostAnalyzer;
  }

  generate(
    preset,
    seed,
    { includeSurfaceSamples = true, includeLodCostSummaries = false } = {},
  ) {
    const config = parseWhorledConiferConfig(preset);
    const random = new SeededRandom(seed);
    const structure = createStructure(preset, config, random);
    const lobes = structure.lobes;
    const crown = createCrownSummary(lobes);
    const lobeConnections = this.lobeConnectionAnalyzer.analyze(lobes);
    const shell = includeSurfaceSamples
      ? this.foliageShellGenerator.generate(
          preset,
          lobes,
          new SeededRandom(
            (seed ^ WHORLED_CONIFER_CONSTANTS.shellSeedSalt) >>> 0,
          ),
        )
      : createEmptyFoliageShell(lobes);
    const treeData = createLegacyTreeData({
      preset,
      seed,
      lobes,
      lobeConnections,
      shell,
      structure,
      crownCenter: crown.center,
      lodCostAnalyzer: this.lodCostAnalyzer,
      includeLodCostSummaries,
    });

    return createTreeIrFromLegacyTreeData(treeData);
  }
}
