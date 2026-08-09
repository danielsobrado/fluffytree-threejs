import { BranchGenerator } from './branch-generator.js';
import { CrownEnvelope } from './crown-envelope.js';
import { createCrownSummary } from './crown-summary.js';
import { FoliageShellGenerator } from './foliage-shell-generator.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { lobeAxisAlignedExtents } from './lobe-geometry.js';
import { LobeConnectionAnalyzer } from './lobe-connection-analyzer.js';
import { LobeConnectivityEnforcer } from './lobe-connectivity-enforcer.js';
import { LobeGenerator } from './lobe-generator.js';
import { SeededRandom } from './seeded-random.js';

function createShellSeed(seed) {
  return (Number(seed) ^ FOLIAGE_SHELL_CONSTANTS.seedSalt) >>> 0;
}

function createEmptySurfaceSamples(lobes) {
  return {
    instances: [],
    lobeExposure: lobes.map(() => 1),
    maximumCandidateCoverageRatio: 0,
  };
}

function createClumpRecords(lobes, branches) {
  const terminalBranchIds = new Map();
  for (const branch of branches) {
    if (!terminalBranchIds.has(branch.macroClumpId)) {
      terminalBranchIds.set(branch.macroClumpId, []);
    }
    terminalBranchIds.get(branch.macroClumpId).push(branch.id);
  }

  const records = new Map();
  for (const lobe of lobes) {
    if (!records.has(lobe.macroClumpId)) {
      records.set(lobe.macroClumpId, {
        id: lobe.macroClumpId,
        lobeIds: [],
        branchIds: new Set(),
      });
    }
    const record = records.get(lobe.macroClumpId);
    record.lobeIds.push(lobe.id);
    record.branchIds.add(lobe.branchId);
  }

  return Object.freeze(
    [...records.values()].map((record) =>
      Object.freeze({
        id: record.id,
        lobeIds: Object.freeze(record.lobeIds),
        branchIds: Object.freeze([...record.branchIds]),
        terminalBranchIds: Object.freeze(terminalBranchIds.get(record.id) ?? []),
      }),
    ),
  );
}

function createBounds(height, lobes) {
  const minimum = { x: 0, y: 0, z: 0 };
  const maximum = { x: 0, y: height, z: 0 };
  for (const lobe of lobes) {
    const extent = lobeAxisAlignedExtents(lobe);
    minimum.x = Math.min(minimum.x, lobe.position.x - extent.x);
    minimum.y = Math.min(minimum.y, lobe.position.y - extent.y);
    minimum.z = Math.min(minimum.z, lobe.position.z - extent.z);
    maximum.x = Math.max(maximum.x, lobe.position.x + extent.x);
    maximum.y = Math.max(maximum.y, lobe.position.y + extent.y);
    maximum.z = Math.max(maximum.z, lobe.position.z + extent.z);
  }
  return Object.freeze({
    minimum: Object.freeze(minimum),
    maximum: Object.freeze(maximum),
  });
}

export class TreeGenerator {
  constructor({
    lobeGenerator = new LobeGenerator(),
    lobeConnectivityEnforcer = new LobeConnectivityEnforcer(),
    lobeConnectionAnalyzer = new LobeConnectionAnalyzer(),
    branchGenerator = new BranchGenerator(),
    foliageShellGenerator = new FoliageShellGenerator(),
    lodCostAnalyzer = null,
  } = {}) {
    this.lobeGenerator = lobeGenerator;
    this.lobeConnectivityEnforcer = lobeConnectivityEnforcer;
    this.lobeConnectionAnalyzer = lobeConnectionAnalyzer;
    this.branchGenerator = branchGenerator;
    this.foliageShellGenerator = foliageShellGenerator;
    this.lodCostAnalyzer = lodCostAnalyzer;
  }

  generate(
    preset,
    seed,
    { includeSurfaceSamples = true, includeLodCostSummaries = false } = {},
  ) {
    const random = new SeededRandom(seed);
    const envelope = new CrownEnvelope(preset.crown);
    const generatedLobes = this.lobeGenerator.generate(preset, envelope, random);
    const connectedLobes = this.lobeConnectivityEnforcer.enforce(generatedLobes);
    const structure = this.branchGenerator.generate(preset, connectedLobes, random);
    const lobes = structure.lobes;
    const crown = createCrownSummary(lobes);
    const lobeConnections = this.lobeConnectionAnalyzer.analyze(lobes);
    const shell = includeSurfaceSamples
      ? this.foliageShellGenerator.generate(
          preset,
          lobes,
          new SeededRandom(createShellSeed(seed)),
        )
      : createEmptySurfaceSamples(lobes);

    const tree = {
      presetId: preset.id,
      seed,
      height: preset.height,
      crownProfile: preset.crown.profile,
      crownCenter: crown.center,
      continuity: preset.continuity ?? null,
      lobes: Object.freeze(lobes),
      lobeConnections,
      lobeExposure: Object.freeze(shell.lobeExposure),
      shell: Object.freeze(shell.instances),
      shellCandidateCoverageRatio: shell.maximumCandidateCoverageRatio,
      trunk: Object.freeze(structure.trunk),
      branches: Object.freeze(structure.branches),
      branchGraph: Object.freeze({
        trunk: Object.freeze(structure.trunk),
        branches: Object.freeze(structure.branches),
      }),
      clumps: createClumpRecords(lobes, structure.branches),
      sprayRecords: Object.freeze(shell.instances),
      bounds: createBounds(preset.height, lobes),
      palette: preset.foliage,
      trunkColor: preset.trunk.color,
      barkPalette: preset.trunk.barkPalette,
    };

    if (includeLodCostSummaries) {
      if (typeof this.lodCostAnalyzer !== 'function') {
        throw new Error('LOD cost summaries require an injected analyzer.');
      }
      tree.lodCostSummaries = this.lodCostAnalyzer(tree);
    }

    return Object.freeze(tree);
  }
}
