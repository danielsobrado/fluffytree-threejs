import { BranchGenerator } from './branch-generator.js';
import { CrownEnvelope } from './crown-envelope.js';
import { LobeGenerator } from './lobe-generator.js';
import { SeededRandom } from './seeded-random.js';

export class TreeGenerator {
  constructor({
    lobeGenerator = new LobeGenerator(),
    branchGenerator = new BranchGenerator(),
  } = {}) {
    this.lobeGenerator = lobeGenerator;
    this.branchGenerator = branchGenerator;
  }

  generate(preset, seed) {
    const random = new SeededRandom(seed);
    const envelope = new CrownEnvelope(preset.crown);
    const lobes = this.lobeGenerator.generate(preset, envelope, random);
    const structure = this.branchGenerator.generate(preset, lobes, random);

    return Object.freeze({
      presetId: preset.id,
      seed,
      height: preset.height,
      lobes: Object.freeze(lobes),
      trunk: Object.freeze(structure.trunk),
      branches: Object.freeze(structure.branches),
      palette: Object.freeze({ ...preset.foliage }),
      trunkColor: preset.trunk.color,
    });
  }
}
