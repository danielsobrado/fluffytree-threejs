import * as THREE from 'three';
import { FOLIAGE_PRIMITIVE_FAMILIES } from '../generation/tree-ir-schema.js';
import { BILLBOARD_TEXTURE_SIZE } from './tree-billboard-atlas.js';
import { calculateTreeIrImpostorLayout } from './tree-ir-impostor-layout.js';

const PADDING_RATIO = 0.08;
const STRUCTURE_WIDTH_MARGIN = 1.5;
const DEFAULT_BARK_COLOR = '#5f4c3d';
const DEFAULT_FOLIAGE_COLOR = '#486847';

function materialMetadata(treeIr) {
  return treeIr.metadata?.material ?? {};
}

function paletteColor(palette, ratio = 0.5) {
  if (!Array.isArray(palette) || palette.length === 0) {
    return DEFAULT_FOLIAGE_COLOR;
  }
  const index = Math.min(
    palette.length - 1,
    Math.max(0, Math.round(ratio * (palette.length - 1))),
  );
  return palette[index];
}

function drawStructure(context, treeIr, layout) {
  const metadata = materialMetadata(treeIr);
  const barkPalette = metadata.barkPalette;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle =
    Array.isArray(barkPalette) && barkPalette.length > 0
      ? barkPalette[Math.min(1, barkPalette.length - 1)]
      : metadata.trunkColor ?? DEFAULT_BARK_COLOR;

  for (const stem of treeIr.stems) {
    for (let index = 1; index < stem.path.length; index += 1) {
      const from = layout.point(stem.path[index - 1]);
      const to = layout.point(stem.path[index]);
      const t = index / Math.max(1, stem.path.length - 1);
      const radius = THREE.MathUtils.lerp(stem.startRadius, stem.endRadius, t);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.lineWidth = Math.max(
        1,
        radius * 2 * layout.scale * STRUCTURE_WIDTH_MARGIN,
      );
      context.stroke();
    }
  }
}

function drawCrownVolumes(context, treeIr, layout) {
  const palette = materialMetadata(treeIr).foliagePalette;
  const ordered = [...treeIr.crownVolumes].sort(
    (left, right) => layout.point(left.center).depth - layout.point(right.center).depth,
  );

  for (const volume of ordered) {
    const center = layout.point(volume.center);
    const radiusX = Math.max(volume.scale.x, volume.scale.z) * layout.scale;
    const radiusY = volume.scale.y * layout.scale;
    context.beginPath();
    context.ellipse(center.x, center.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fillStyle = paletteColor(palette, volume.colorMix ?? 0.5);
    context.globalAlpha = Math.min(1, Math.max(0.2, volume.density ?? 1));
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawFronds(context, treeIr, layout) {
  const palette = materialMetadata(treeIr).foliagePalette;
  const color = paletteColor(palette, 0.58);
  context.strokeStyle = color;
  context.lineCap = 'round';

  for (const site of treeIr.foliageSites) {
    if (site.primitiveFamily !== FOLIAGE_PRIMITIVE_FAMILIES.FROND) continue;
    const frond = site.metadata?.frond;
    if (!frond) continue;
    const start = site.frame.position;
    const tangent = site.frame.tangent;
    const end = {
      x: start.x + tangent.x * frond.length,
      y: start.y + tangent.y * frond.length,
      z: start.z + tangent.z * frond.length,
    };
    const midpoint = {
      x: (start.x + end.x) * 0.5,
      y:
        (start.y + end.y) * 0.5 -
        frond.length * Number(frond.droop ?? 0) * 0.18,
      z: (start.z + end.z) * 0.5,
    };
    const projectedStart = layout.point(start);
    const projectedMidpoint = layout.point(midpoint);
    const projectedEnd = layout.point(end);
    context.beginPath();
    context.moveTo(projectedStart.x, projectedStart.y);
    context.quadraticCurveTo(
      projectedMidpoint.x,
      projectedMidpoint.y,
      projectedEnd.x,
      projectedEnd.y,
    );
    context.lineWidth = Math.max(1, frond.width * layout.scale * 0.55);
    context.stroke();
  }
}

function paintCanvas(treeIr, layout) {
  const canvas = document.createElement('canvas');
  canvas.width = BILLBOARD_TEXTURE_SIZE;
  canvas.height = BILLBOARD_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the Tree IR impostor canvas.');

  drawStructure(context, treeIr, layout);
  drawCrownVolumes(context, treeIr, layout);
  drawFronds(context, treeIr, layout);
  return canvas;
}

function createTexture(treeIr, rotationY, capture) {
  const layout = calculateTreeIrImpostorLayout(treeIr, rotationY, {
    textureSize: BILLBOARD_TEXTURE_SIZE,
    paddingRatio: PADDING_RATIO,
  });
  const canvas = capture ? capture(layout, rotationY) : paintCanvas(treeIr, layout);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `tree-ir-impostor-${treeIr.presetId}-${treeIr.seed}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { texture, layout };
}

export class TreeIrImpostorBuilder {
  build(treeIr, { rotationY = 0, capture = null } = {}) {
    const { texture, layout } = createTexture(treeIr, rotationY, capture);
    let material = null;

    try {
      material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.08,
        depthWrite: true,
        fog: true,
        toneMapped: true,
      });
      material.name = 'tree-ir-impostor-material';
      material.userData.disposables = [texture];

      const sprite = new THREE.Sprite(material);
      sprite.name = 'tree-impostor';
      sprite.center.set(0.5, 0.5);
      sprite.position.set(layout.anchor.x, layout.anchor.y, layout.anchor.z);
      sprite.scale.set(layout.worldSize, layout.worldSize, 1);
      sprite.userData.impostor = {
        triangleCount: 2,
        textureSize: BILLBOARD_TEXTURE_SIZE,
        rotationY,
        contentWidth: layout.width,
        contentHeight: layout.height,
        worldSize: layout.worldSize,
      };

      material = null;
      return sprite;
    } catch (error) {
      material?.dispose();
      texture.dispose();
      throw error;
    }
  }
}
