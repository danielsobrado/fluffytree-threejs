import { BranchGenerator } from './branch-generator.js';
import { CrownEnvelope } from './crown-envelope.js';
import { createCrownSummary } from './crown-summary.js';
import { FoliageShellGenerator } from './foliage-shell-generator.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
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
  };
}

export class TreeGenerator {
  constructor({
    lobeGenerator = new LobeGenerator(),
    lobeConnectivityEnforcer = new LobeConnectivityEnforcer(),
    branchGenerator = new BranchGenerator(),
    foliageShellGenerator = new FoliageShellGenerator(),
  } = {}) {
    this.lobeGenerator = lobeGenerator;
    this.lobeConnectivityEnforcer = lobeConnectivityEnforcer;
    this.branchGenerator = branchGenerator;
    this.foliageShellGenerator = foliageShellGenerator;
  }

  generate(preset, seed, { includeSurfaceSamples = true } = {}) {
    const random = new SeededRandom(seed);
    const envelope = new CrownEnvelope(preset.crown);
    const generatedLobes = this.lobeGenerator.generate(preset, envelope, random);
    const lobes = this.lobeConnectivityEnforcer.enforce(generatedLobes);
    const crown = createCrownSummary(lobes);
    const structure = this.branchGenerator.generate(preset, lobes, random);
    const shell = includeSurfaceSamples
      ? this.foliageShellGenerator.generate(
          preset,
          lobes,
          new SeededRandom(createShellSeed(seed)),
        )
      : createEmptySurfaceSamples(lobes);

    return Object.freeze({
      presetId: preset.id,
      seed,
      height: preset.height,
      crownCenter: crown.center,
      lobes: Object.freeze(lobes),
      lobeExposure: Object.freeze(shell.lobeExposure),
      shell: Object.freeze(shell.instances),
      trunk: Object.freeze(structure.trunk),
      branches: Object.freeze(structure.branches),
      palette: preset.foliage,
      trunkColor: preset.trunk.color,
    });
  }
}
