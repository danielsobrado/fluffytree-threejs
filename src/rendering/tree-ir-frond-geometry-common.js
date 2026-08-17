import * as THREE from 'three';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';
import { treeIrStyleUnit } from './tree-ir-style-random.js';

const TAU = Math.PI * 2;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function widthEnvelope(t) {
  return 0.08 + 0.92 * Math.sin(Math.PI * t) ** 0.65;
}

function windWeight(t) {
  const value = clamp01(t);
  return value * value * (3 - 2 * value);
}

export function requireTreeIrFrond(site) {
  const frond = site.metadata?.frond;
  if (!frond) {
    throw new Error(`Frond foliage site '${site.id}' has no frond metadata.`);
  }
  return frond;
}

export function createTreeIrFrondSampler(site, frond) {
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

export function createTreeIrFrondBuffers() {
  return {
    positions: [],
    colors: [],
    windWeights: [],
    windPhases: [],
    indices: [],
  };
}

export function treeIrFrondWindPhase(treeIr, site) {
  return treeIrStyleUnit(treeIr, site.id, 'frond-wind-phase') * TAU;
}

export function setTreeIrFrondColor(
  color,
  treeIr,
  site,
  t,
  offset = 0,
) {
  const base = treeIrStyleUnit(treeIr, site.id, 'frond-color');
  const mix = clamp01(base * 0.65 + t * 0.35 + offset);
  return setTreeIrPaletteColor(
    color,
    treeIr.metadata.material.foliagePalette,
    mix,
  );
}

export function appendTreeIrFrondVertex(
  buffers,
  point,
  color,
  t,
  phase,
) {
  buffers.positions.push(point.x, point.y, point.z);
  buffers.colors.push(color.r, color.g, color.b);
  buffers.windWeights.push(windWeight(t));
  buffers.windPhases.push(phase);
  return buffers.positions.length / 3 - 1;
}

export function offsetTreeIrFrondPoint(sample, distance) {
  return {
    x: sample.x + sample.sideX * distance,
    y: sample.y,
    z: sample.z + sample.sideZ * distance,
  };
}

export function finishTreeIrFrondGeometry(buffers) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(buffers.positions, 3),
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(buffers.colors, 3),
  );
  geometry.setAttribute(
    'treeFrondWindWeight',
    new THREE.Float32BufferAttribute(buffers.windWeights, 1),
  );
  geometry.setAttribute(
    'treeFrondWindPhase',
    new THREE.Float32BufferAttribute(buffers.windPhases, 1),
  );
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
