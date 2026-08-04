import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';
import { BILLBOARD_TEXTURE_SIZE } from './tree-billboard-atlas.js';
import { calculateRootFlareScale } from './root-flare-profile.js';
import {
  calculateImpostorLayout,
  projectImpostorLobe,
} from './tree-impostor-math.js';

const PADDING_RATIO = 0.08;
// Painted bark over-covers slightly. Extra dark pixels are invisible at the
// sizes this level renders at; a shortfall is a hole.
const STRUCTURE_WIDTH_MARGIN = 1.5;

/**
 * A flat stroke cannot follow a swept trunk exactly once perspective is applied,
 * and the mismatch is worst on the styles that move the trunk furthest sideways.
 * Each segment is therefore stroked at its own width, widened by the root flare
 * near the ground, so the painted trunk covers the geometry it stands in for
 * rather than falling inside it and opening a gap during the crossfade.
 */
function strokeWidthAt(point, path, treeData, project) {
  const radius = Number(point.radius ?? path.startRadius);
  const flareScale =
    path === treeData.trunk
      ? calculateRootFlareScale(treeData.trunk.flare, point.y)
      : 1;
  return Math.max(
    1,
    radius * flareScale * 2 * project.scale * STRUCTURE_WIDTH_MARGIN,
  );
}

function drawStructure(context, treeData, project) {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = treeData.barkPalette[1];
  const paths = [treeData.trunk, ...treeData.branches];

  for (const path of paths) {
    const points = path.points;
    if (points.length < 2) continue;

    for (let index = 1; index < points.length; index += 1) {
      const from = project.point(points[index - 1]);
      const to = project.point(points[index]);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.lineWidth = Math.max(
        strokeWidthAt(points[index - 1], path, treeData, project),
        strokeWidthAt(points[index], path, treeData, project),
      );
      context.stroke();
    }
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

/**
 * The rendered canopy reaches past the lobe surface by roughly half a leaf card,
 * because the cards are centred on that surface. An impostor painted from the
 * bare lobes therefore stands in for a smaller tree than the one it replaces,
 * and the far level loses silhouette against the near one. Inflating the lobes
 * by that protrusion keeps the footprint the same across the switch.
 *
 * Only the crown is inflated. The trunk and branches are drawn at their own
 * size, which is what they render at.
 */
function inflateCanopyLobes(treeData) {
  const shell = treeData.palette.shell;
  const protrusion =
    shell.cardScaleSample *
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier *
    0.5;
  const inflation = 1 + protrusion;

  return {
    ...treeData,
    lobes: treeData.lobes.map((lobe) => ({
      ...lobe,
      scale: {
        x: lobe.scale.x * inflation,
        y: lobe.scale.y * inflation,
        z: lobe.scale.z * inflation,
      },
    })),
  };
}

function createTexture(treeData, rotationY) {
  const canvas = document.createElement('canvas');
  canvas.width = BILLBOARD_TEXTURE_SIZE;
  canvas.height = BILLBOARD_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the tree impostor canvas.');

  const canopy = inflateCanopyLobes(treeData);
  const project = calculateImpostorLayout(canopy, rotationY, {
    textureSize: BILLBOARD_TEXTURE_SIZE,
    paddingRatio: PADDING_RATIO,
  });
  drawStructure(context, treeData, project);
  drawCrown(context, canopy, project, rotationY);

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
