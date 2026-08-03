import * as THREE from 'three';
import { BILLBOARD_TEXTURE_SIZE } from './tree-billboard-atlas.js';
import {
  calculateImpostorLayout,
  projectImpostorLobe,
} from './tree-impostor-math.js';

const PADDING_RATIO = 0.08;

function drawStructure(context, treeData, project) {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const paths = [treeData.trunk, ...treeData.branches];

  for (const path of paths) {
    const points = path.points;
    if (points.length < 2) continue;
    context.beginPath();
    const first = project.point(points[0]);
    context.moveTo(first.x, first.y);
    for (const point of points.slice(1)) {
      const projected = project.point(point);
      context.lineTo(projected.x, projected.y);
    }
    context.lineWidth = Math.max(1, path.startRadius * project.scale * 1.5);
    context.strokeStyle = treeData.barkPalette[1];
    context.stroke();
  }
}

function drawCrown(context, treeData, project, rotationY) {
  const palette = treeData.palette.palette;
  const ordered = treeData.lobes
    .map((lobe) => ({ lobe, projected: projectImpostorLobe(lobe, rotationY) }))
    .sort((left, right) => left.projected.depth - right.projected.depth);

  for (const { lobe, projected } of ordered) {
    const center = project.point(lobe.position);
    const paletteIndex = Math.min(
      palette.length - 1,
      Math.max(0, Math.round(lobe.colorMix * (palette.length - 1))),
    );
    context.save();
    context.translate(center.x, center.y);
    context.beginPath();
    context.ellipse(
      0,
      0,
      projected.radiusMajor * project.scale,
      projected.radiusMinor * project.scale,
      -projected.angle,
      0,
      Math.PI * 2,
    );
    context.fillStyle = palette[paletteIndex];
    context.fill();
    context.restore();
  }
}

function createTexture(treeData, rotationY) {
  const canvas = document.createElement('canvas');
  canvas.width = BILLBOARD_TEXTURE_SIZE;
  canvas.height = BILLBOARD_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the tree impostor canvas.');

  const project = calculateImpostorLayout(treeData, rotationY, {
    textureSize: BILLBOARD_TEXTURE_SIZE,
    paddingRatio: PADDING_RATIO,
  });
  drawStructure(context, treeData, project);
  drawCrown(context, treeData, project, rotationY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `tree-impostor-${treeData.presetId}-${treeData.seed}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { texture, project };
}

export class TreeImpostorBuilder {
  build(treeData, { rotationY = 0 } = {}) {
    const { texture, project } = createTexture(treeData, rotationY);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: true,
      fog: true,
      toneMapped: true,
    });
    material.name = 'tree-impostor-material';
    material.userData.disposables = [texture];

    const sprite = new THREE.Sprite(material);
    sprite.name = 'tree-impostor';
    sprite.center.set(0.5, 0.5);
    sprite.position.set(project.anchor.x, project.anchor.y, project.anchor.z);
    sprite.scale.set(project.worldSize, project.worldSize, 1);
    sprite.userData.impostor = {
      triangleCount: 2,
      textureSize: BILLBOARD_TEXTURE_SIZE,
      rotationY,
      contentWidth: project.width,
      contentHeight: project.height,
      worldSize: project.worldSize,
    };
    return sprite;
  }
}
