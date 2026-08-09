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
    return Object.freeze({
      palette: palette ? this.paletteTextureFactory.create(foliage.palette) : null,
      alpha: alpha ? this.alphaTextureFactory.create(foliage.leafShape) : null,
    });
  }
}
