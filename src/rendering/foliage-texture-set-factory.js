import { FoliageAlphaTextureFactory } from './foliage-alpha-texture-factory.js';
import { PaletteTextureFactory } from './palette-texture-factory.js';

export class FoliageTextureSetFactory {
  constructor({
    paletteTextureFactory = new PaletteTextureFactory(),
    alphaTextureFactory = new FoliageAlphaTextureFactory(),
  } = {}) {
    this.paletteTextureFactory = paletteTextureFactory;
    this.alphaTextureFactory = alphaTextureFactory;
  }

  create(foliage, { palette = true, alpha = true } = {}) {
    let paletteTexture = null;

    try {
      paletteTexture = palette
        ? this.paletteTextureFactory.create(foliage.palette)
        : null;
      const alphaTexture = alpha
        ? this.alphaTextureFactory.create(foliage.leafShape)
        : null;

      return Object.freeze({
        palette: paletteTexture,
        alpha: alphaTexture,
      });
    } catch (error) {
      paletteTexture?.dispose();
      throw error;
    }
  }
}
