import * as THREE from 'three';

const TEXTURE_SIZE = 128;
const PADDING_RATIO = 0.08;

function calculateBounds(treeData) {
  const minimum = { x: 0, y: 0 };
  const maximum = { x: 0, y: treeData.height };
  for (const lobe of treeData.lobes) {
    minimum.x = Math.min(minimum.x, lobe.position.x - lobe.scale.x);
    minimum.y = Math.min(minimum.y, lobe.position.y - lobe.scale.y);
    maximum.x = Math.max(maximum.x, lobe.position.x + lobe.scale.x);
    maximum.y = Math.max(maximum.y, lobe.position.y + lobe.scale.y);
  }
  return { minimum, maximum };
}

function createProjector(bounds) {
  const width = bounds.maximum.x - bounds.minimum.x;
  const height = bounds.maximum.y - bounds.minimum.y;
  const padding = TEXTURE_SIZE * PADDING_RATIO;
  const scale = Math.min(
    (TEXTURE_SIZE - padding * 2) / width,
    (TEXTURE_SIZE - padding * 2) / height,
  );
  return {
    width,
    height,
    point(value) {
      return {
        x: (value.x - bounds.minimum.x) * scale + padding,
        y: TEXTURE_SIZE - ((value.y - bounds.minimum.y) * scale + padding),
      };
    },
    scale,
  };
}

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

function drawCrown(context, treeData, project) {
  const palette = treeData.palette.palette;
  const ordered = [...treeData.lobes].sort(
    (left, right) => left.position.z - right.position.z,
  );

  for (const lobe of ordered) {
    const center = project.point(lobe.position);
    const radiusX = lobe.scale.x * project.scale;
    const radiusY = lobe.scale.y * project.scale;
    const paletteIndex = Math.min(
      palette.length - 1,
      Math.max(0, Math.round(lobe.colorMix * (palette.length - 1))),
    );
    context.save();
    context.translate(center.x, center.y);
    context.rotate(-lobe.rotation.z);
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fillStyle = palette[paletteIndex];
    context.fill();
    context.restore();
  }
}

function createTexture(treeData) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  const bounds = calculateBounds(treeData);
  const project = createProjector(bounds);
  drawStructure(context, treeData, project);
  drawCrown(context, treeData, project);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `tree-impostor-${treeData.presetId}-${treeData.seed}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { texture, bounds, project };
}

export class TreeImpostorBuilder {
  build(treeData) {
    const { texture, bounds, project } = createTexture(treeData);
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
    sprite.center.set(0.5, 0);
    sprite.position.set(
      (bounds.minimum.x + bounds.maximum.x) * 0.5,
      bounds.minimum.y,
      0,
    );
    sprite.scale.set(project.width, project.height, 1);
    sprite.userData.impostor = { triangleCount: 2, textureSize: TEXTURE_SIZE };
    return sprite;
  }
}
