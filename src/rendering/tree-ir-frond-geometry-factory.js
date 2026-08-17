import * as THREE from 'three';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';
import { treeIrStyleUnit } from './tree-ir-style-random.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function requireFrond(site) {
  const frond = site.metadata?.frond;
  if (!frond) {
    throw new Error(`Frond foliage site '${site.id}' has no frond metadata.`);
  }
  return frond;
}

function widthEnvelope(t) {
  return 0.08 + 0.92 * Math.sin(Math.PI * t) ** 0.65;
}

function createSampler(site, frond) {
  const start = site.frame.position;
  const forwardX = Math.cos(frond.azimuth);
  const forwardZ = Math.sin(frond.azimuth);
  const sideX = -forwardZ;
  const sideZ = forwardX;

  return (t) => ({
    x: start.x + forwardX * frond.length * t,
    y:
      start.y +
      frond.length * (frond.rise * t - frond.droop * 0.68 * t * t),
    z: start.z + forwardZ * frond.length * t,
    halfWidth: frond.width * widthEnvelope(t) * 0.5,
    sideX,
    sideZ,
  });
}

function colorMix(treeIr, site, t, offset = 0) {
  const base = treeIrStyleUnit(treeIr, site.id, 'frond-color');
  return clamp01(base * 0.65 + t * 0.35 + offset);
}

function appendVertex(positions, colors, point, color) {
  positions.push(point.x, point.y, point.z);
  colors.push(color.r, color.g, color.b);
  return positions.length / 3 - 1;
}

function offsetPoint(sample, distance) {
  return {
    x: sample.x + sample.sideX * distance,
    y: sample.y,
    z: sample.z + sample.sideZ * distance,
  };
}

function finishGeometry(positions, colors, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createRibbonGeometry(treeIr, site, frond, segmentCount) {
  const sample = createSampler(site, frond);
  const positions = [];
  const colors = [];
  const indices = [];
  const palette = treeIr.metadata.material.foliagePalette;
  const color = new THREE.Color();

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const center = sample(t);
    setTreeIrPaletteColor(color, palette, colorMix(treeIr, site, t));
    appendVertex(positions, colors, offsetPoint(center, -center.halfWidth), color);
    appendVertex(positions, colors, offsetPoint(center, center.halfWidth), color);

    if (index < segmentCount) {
      const left = index * 2;
      const right = left + 1;
      const nextLeft = left + 2;
      const nextRight = left + 3;
      indices.push(left, nextLeft, right, right, nextLeft, nextRight);
    }
  }

  return finishGeometry(positions, colors, indices);
}

function appendRachis(
  treeIr,
  site,
  frond,
  segmentCount,
  rachisWidthRatio,
  positions,
  colors,
  indices,
) {
  const sample = createSampler(site, frond);
  const palette = treeIr.metadata.material.foliagePalette;
  const color = new THREE.Color();
  const firstVertex = positions.length / 3;
  const halfWidth = Math.max(0.006, frond.width * rachisWidthRatio * 0.5);

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const center = sample(t);
    setTreeIrPaletteColor(
      color,
      palette,
      colorMix(treeIr, site, t, -0.08),
    );
    appendVertex(positions, colors, offsetPoint(center, -halfWidth), color);
    appendVertex(positions, colors, offsetPoint(center, halfWidth), color);

    if (index < segmentCount) {
      const left = firstVertex + index * 2;
      const right = left + 1;
      const nextLeft = left + 2;
      const nextRight = left + 3;
      indices.push(left, nextLeft, right, right, nextLeft, nextRight);
    }
  }
}

function appendLeaflets(
  treeIr,
  site,
  frond,
  segmentCount,
  {
    rachisWidthRatio,
    leafletLengthRatio,
    leafletWidthRatio,
  },
  positions,
  colors,
  indices,
) {
  const sample = createSampler(site, frond);
  const palette = treeIr.metadata.material.foliagePalette;
  const color = new THREE.Color();
  const step = 1 / segmentCount;
  const rachisHalfWidth = Math.max(
    0.006,
    frond.width * rachisWidthRatio * 0.5,
  );

  for (let index = 0; index < segmentCount; index += 1) {
    const t = (index + 0.5) * step;
    const halfSpan = step * leafletWidthRatio * 0.5;
    const before = sample(Math.max(0, t - halfSpan));
    const after = sample(Math.min(1, t + halfSpan));
    const center = sample(t);

    for (const sign of [-1, 1]) {
      const sideOffset = sign < 0 ? -0.035 : 0.035;
      setTreeIrPaletteColor(
        color,
        palette,
        colorMix(treeIr, site, t, sideOffset),
      );
      const first = appendVertex(
        positions,
        colors,
        offsetPoint(before, sign * rachisHalfWidth),
        color,
      );
      const second = appendVertex(
        positions,
        colors,
        offsetPoint(after, sign * rachisHalfWidth),
        color,
      );
      const tip = appendVertex(
        positions,
        colors,
        offsetPoint(center, sign * center.halfWidth * leafletLengthRatio),
        color,
      );

      if (sign < 0) indices.push(first, tip, second);
      else indices.push(first, second, tip);
    }
  }
}

function createLeafletGeometry(treeIr, site, frond, segmentCount, style) {
  const positions = [];
  const colors = [];
  const indices = [];
  appendRachis(
    treeIr,
    site,
    frond,
    segmentCount,
    style.rachisWidthRatio,
    positions,
    colors,
    indices,
  );
  appendLeaflets(
    treeIr,
    site,
    frond,
    segmentCount,
    style,
    positions,
    colors,
    indices,
  );
  return finishGeometry(positions, colors, indices);
}

export class TreeIrFrondGeometryFactory {
  create(
    treeIr,
    site,
    {
      segmentRatio = 1,
      leaflets = false,
      rachisWidthRatio = 0.08,
      leafletLengthRatio = 0.96,
      leafletWidthRatio = 0.72,
    } = {},
  ) {
    const frond = requireFrond(site);
    const segmentCount = Math.max(
      2,
      Math.round(frond.segmentCount * segmentRatio),
    );
    if (!leaflets) {
      return createRibbonGeometry(treeIr, site, frond, segmentCount);
    }
    return createLeafletGeometry(treeIr, site, frond, segmentCount, {
      rachisWidthRatio,
      leafletLengthRatio,
      leafletWidthRatio,
    });
  }
}
