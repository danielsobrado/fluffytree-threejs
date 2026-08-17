import * as THREE from 'three';
import {
  BILLBOARD_ATLAS_GUTTER_PIXELS,
  calculateBillboardAtlasSlot,
  calculateBillboardAtlasUvTransform,
  createBillboardAtlasLayout,
} from './tree-billboard-atlas.js';
import { drawBillboardAtlasCell } from './tree-billboard-atlas-rasterizer.js';

function requireImage(texture) {
  const image = texture?.image;
  if (!image?.width || !image?.height) {
    throw new Error('The tree impostor texture has no drawable image.');
  }
  return image;
}

export function createTreeBillboardAtlas(capacity, sourceTexture) {
  const image = requireImage(sourceTexture);
  const layout = createBillboardAtlasLayout(capacity);
  const gutter = BILLBOARD_ATLAS_GUTTER_PIXELS;
  const cellWidth = image.width + gutter * 2;
  const cellHeight = image.height + gutter * 2;
  const canvas = document.createElement('canvas');
  canvas.width = cellWidth * layout.columns;
  canvas.height = cellHeight * layout.rows;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the tree billboard atlas.');

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'tree-impostor-atlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return {
    canvas,
    context,
    texture,
    layout,
    cellWidth,
    cellHeight,
    gutter,
  };
}

export function writeTreeBillboardAtlasCell(atlas, index, sourceTexture) {
  const image = requireImage(sourceTexture);
  const slot = calculateBillboardAtlasSlot(index, atlas.layout);
  drawBillboardAtlasCell(
    atlas.context,
    image,
    slot.column * atlas.cellWidth,
    slot.row * atlas.cellHeight,
    atlas.gutter,
  );
  atlas.texture.needsUpdate = true;
  return calculateBillboardAtlasUvTransform(
    slot,
    atlas.canvas.width,
    atlas.canvas.height,
    atlas.gutter,
  );
}
