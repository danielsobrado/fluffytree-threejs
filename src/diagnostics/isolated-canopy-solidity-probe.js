import { parseCanopySolidityQaConfig } from '../qa/canopy-solidity-qa-config.js';
import {
  restoreObjectLodFade,
  snapshotObjectLodFade,
} from '../rendering/lod-dither-fade.js';
import { CanopySolidityProbe } from './canopy-solidity-probe.js';

const SOLIDITY_CONFIG_SUFFIX = 'canopy-solidity-qa.yaml';

export class IsolatedCanopySolidityProbe extends CanopySolidityProbe {
  constructor(options = {}) {
    super(options);
    const loader = this.configLoader;
    this.configLoader = {
      load: async (url) => {
        const config = await loader.load(url);
        return String(url).endsWith(SOLIDITY_CONFIG_SUFFIX)
          ? parseCanopySolidityQaConfig(config)
          : config;
      },
    };
  }

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
