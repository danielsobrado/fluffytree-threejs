import { BranchGenerator } from './branch-generator.js';
import { CrownEnvelope } from './crown-envelope.js';
import { createCrownSummary } from './crown-summary.js';
import { FoliageShellGenerator } from './foliage-shell-generator.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { LobeConnectionAnalyzer } from './lobe-connection-analyzer.js';
import { LobeConnectivityEnforcer } from './lobe-connectivity-enforcer.js';
import { LobeGenerator } from './lobe-generator.js';
import {
  createEmptyFoliageShell,
  createLegacyTreeData,
} from './legacy-tree-data-factory.js';
import { SeededRandom } from './seeded-random.js';
import { createTreeIrFromLegacyTreeData } from './tree-ir-from-legacy-data.js';

function createShellSeed(seed) {
  return (Number(seed) ^ FOLIAGE_SHELL_CONSTANTS.seedSalt) >>> 0;
}

export class CrownLobeTreeGenerator {
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
