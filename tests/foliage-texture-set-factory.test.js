import assert from 'node:assert/strict';
import test from 'node:test';
import { FoliageTextureSetFactory } from '../src/rendering/foliage-texture-set-factory.js';

function createTextureFactory() {
  const textures = [];
  return {
    textures,
    create(value) {
      const texture = {
        value,
        disposeCount: 0,
        dispose() {
          this.disposeCount += 1;
        },
      };
      textures.push(texture);
      return texture;
    },
  };
}

function createFactory() {
  const paletteTextureFactory = createTextureFactory();
  const alphaTextureFactory = createTextureFactory();
  return {
    factory: new FoliageTextureSetFactory({
      paletteTextureFactory,
      alphaTextureFactory,
    }),
    paletteTextureFactory,
    alphaTextureFactory,
  };
}

test('foliage texture leases share identical palette and alpha textures', () => {
  const { factory, paletteTextureFactory, alphaTextureFactory } = createFactory();
  const foliage = { palette: ['#112233', '#445566'], leafShape: 'oval' };
  const first = factory.create(foliage);
  const second = factory.create({ ...foliage, palette: [...foliage.palette] });

  assert.equal(first.palette, second.palette);
  assert.equal(first.alpha, second.alpha);
  assert.equal(paletteTextureFactory.textures.length, 1);
  assert.equal(alphaTextureFactory.textures.length, 1);
  assert.equal(factory.metrics.palette.hits, 1);
  assert.equal(factory.metrics.alpha.hits, 1);

  first.dispose();
  assert.equal(first.dispose(), false);
  assert.equal(paletteTextureFactory.textures[0].disposeCount, 0);
  assert.equal(alphaTextureFactory.textures[0].disposeCount, 0);

  second.dispose();
  assert.equal(paletteTextureFactory.textures[0].disposeCount, 1);
  assert.equal(alphaTextureFactory.textures[0].disposeCount, 1);
  assert.equal(factory.metrics.palette.entries, 0);
  assert.equal(factory.metrics.alpha.entries, 0);
});

test('foliage texture leases share alpha independently from palette', () => {
  const { factory, paletteTextureFactory, alphaTextureFactory } = createFactory();
  const first = factory.create({ palette: ['#111111'], leafShape: 'oval' });
  const second = factory.create({ palette: ['#222222'], leafShape: 'oval' });

  assert.notEqual(first.palette, second.palette);
  assert.equal(first.alpha, second.alpha);
  assert.equal(paletteTextureFactory.textures.length, 2);
  assert.equal(alphaTextureFactory.textures.length, 1);

  first.dispose();
  second.dispose();
});

test('foliage texture leases only acquire requested LOD resources', () => {
  const { factory, paletteTextureFactory, alphaTextureFactory } = createFactory();
  const alphaOnly = factory.create(
    { palette: ['#111111'], leafShape: 'oval' },
    { palette: false, alpha: true },
  );

  assert.equal(alphaOnly.palette, null);
  assert.ok(alphaOnly.alpha);
  assert.equal(paletteTextureFactory.textures.length, 0);
  assert.equal(alphaTextureFactory.textures.length, 1);
  alphaOnly.dispose();
});
