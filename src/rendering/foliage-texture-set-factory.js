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

  create(foliage) {
    return Object.freeze({
      palette: this.paletteTextureFactory.create(foliage.palette),
      alpha: this.alphaTextureFactory.create(),
    });
  }
}
