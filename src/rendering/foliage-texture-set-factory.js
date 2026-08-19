import { RefCountedResourceCache } from '../core/ref-counted-resource-cache.js';
import { FoliageAlphaTextureFactory } from './foliage-alpha-texture-factory.js';
import { PaletteTextureFactory } from './palette-texture-factory.js';

function createTextureSetLease(paletteLease, alphaLease, onRelease) {
  let released = false;

  return Object.freeze({
    palette: paletteLease?.value ?? null,
    alpha: alphaLease?.value ?? null,
    dispose() {
      if (released) return false;
      released = true;
      alphaLease?.release();
      paletteLease?.release();
      onRelease();
      return true;
    },
  });
}

export class FoliageTextureSetFactory {
  constructor({
    paletteTextureFactory = new PaletteTextureFactory(),
    alphaTextureFactory = new FoliageAlphaTextureFactory(),
    paletteTextureCache = new RefCountedResourceCache(),
    alphaTextureCache = new RefCountedResourceCache(),
  } = {}) {
    this.paletteTextureFactory = paletteTextureFactory;
    this.alphaTextureFactory = alphaTextureFactory;
    this.paletteTextureCache = paletteTextureCache;
    this.alphaTextureCache = alphaTextureCache;
  }

  create(foliage, { palette = true, alpha = true } = {}) {
    let paletteLease = null;
    let alphaLease = null;

    try {
      paletteLease = palette
        ? this.paletteTextureCache.acquire(JSON.stringify(foliage.palette), () =>
            this.paletteTextureFactory.create(foliage.palette),
          )
        : null;
      alphaLease = alpha
        ? this.alphaTextureCache.acquire(foliage.leafShape, () =>
            this.alphaTextureFactory.create(foliage.leafShape),
          )
        : null;

      return createTextureSetLease(paletteLease, alphaLease, () => {
        this.clearIdleCaches();
      });
    } catch (error) {
      alphaLease?.release();
      paletteLease?.release();
      this.clearIdleCaches();
      throw error;
    }
  }

  clearIdleCaches() {
    if (
      this.paletteTextureCache.metrics.activeLeases !== 0 ||
      this.alphaTextureCache.metrics.activeLeases !== 0
    ) {
      return;
    }

    this.paletteTextureCache.clear();
    this.alphaTextureCache.clear();
  }

  disposeAll({ force = false } = {}) {
    this.paletteTextureCache.clear({ force });
    this.alphaTextureCache.clear({ force });
  }

  get metrics() {
    return Object.freeze({
      palette: this.paletteTextureCache.metrics,
      alpha: this.alphaTextureCache.metrics,
    });
  }
}
