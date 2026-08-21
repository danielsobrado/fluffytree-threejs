import { BranchGenerator } from './branch-generator.js?v=2.0.0-20260814.2';
import { CrownEnvelope } from './crown-envelope.js?v=2.0.0-20260814.2';
import { createCrownSummary } from './crown-summary.js?v=2.0.0-20260814.2';
import { FoliageShellGenerator } from './foliage-shell-generator.js?v=2.0.0-20260814.2';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js?v=2.0.0-20260814.2';
import { LobeConnectionAnalyzer } from './lobe-connection-analyzer.js?v=2.0.0-20260814.2';
import { LobeConnectivityEnforcer } from './lobe-connectivity-enforcer.js?v=2.0.0-20260814.2';
import { LobeGenerator } from './lobe-generator.js?v=2.0.0-20260814.2';
import {
  createEmptyFoliageShell,
  createLegacyTreeData,
} from './legacy-tree-data-factory.js?v=2.0.0-20260814.2';
import { SeededRandom } from './seeded-random.js?v=2.0.0-20260814.2';
import { createTreeIrFromLegacyTreeData } from './tree-ir-from-legacy-data.js?v=2.0.0-20260814.2';

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
