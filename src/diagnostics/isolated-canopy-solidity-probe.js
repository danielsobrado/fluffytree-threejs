import {
  restoreObjectLodFade,
  snapshotObjectLodFade,
} from '../rendering/lod-dither-fade.js';
import { CanopySolidityProbe } from './canopy-solidity-probe.js';

export class IsolatedCanopySolidityProbe extends CanopySolidityProbe {
  beginIsolation(renderer, scene) {
    const previousRenderTarget = renderer.getRenderTarget();
    const restore = super.beginIsolation(renderer, scene);

    return () => {
      restore();
      renderer.setRenderTarget(previousRenderTarget);
    };
  }

  isolateTree(tree, lodState) {
    const levelSnapshots = lodState.levels.map((level) => ({
      level,
      snapshot: snapshotObjectLodFade(level),
    }));
    const heroChildren = lodState.levels[0].children.map((child) => ({
      child,
      visible: child.visible,
    }));
    const restore = super.isolateTree(tree, lodState);

    return () => {
      restore();
      for (const { level, snapshot } of levelSnapshots) {
        restoreObjectLodFade(level, snapshot);
      }
      for (const { child, visible } of heroChildren) child.visible = visible;
    };
  }
}
