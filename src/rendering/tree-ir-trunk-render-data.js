import { createRenderableTreeIrStemPath } from './tree-ir-render-path.js?v=2.0.0-20260814.2';

export function createTreeIrTrunkRenderData(treeIr, stem) {
  return {
    seed: treeIr.seed,
    height: treeIr.height,
    trunk: {
      points: createRenderableTreeIrStemPath(stem.path),
      startRadius: stem.startRadius,
      endRadius: stem.endRadius,
      flare: Number(stem.metadata?.flare ?? 0),
      taperPower: stem.taperPower,
      nebari: Number(stem.metadata?.nebari ?? 1),
    },
  };
}
