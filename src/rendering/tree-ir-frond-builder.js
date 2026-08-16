import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hashCanonicalValue } from '../core/canonical-value-hash.js';
import { setTreeIrPaletteColor } from './tree-ir-palette.js';

function frondColorMix(treeIr, site, ratio) {
  const hash = hashCanonicalValue([treeIr.seed, site.id]);
  const base = (Number.parseInt(hash.slice(0, 8), 16) >>> 0) / 0x100000000;
  return Math.min(1, Math.max(0, base * 0.65 + ratio * 0.35));
}

function createFrondGeometry(treeIr, site, segmentRatio) {
  const frond = site.metadata?.frond;
  if (!frond) {
    throw new Error(`Frond foliage site '${site.id}' has no frond metadata.`);
  }
  const segmentCount = Math.max(2, Math.round(frond.segmentCount * segmentRatio));
  const positions = new Float32Array((segmentCount + 1) * 2 * 3);
  const colors = new Float32Array((segmentCount + 1) * 2 * 3);
  const indices = [];
  const start = site.frame.position;
  const forwardX = Math.cos(frond.azimuth);
  const forwardZ = Math.sin(frond.azimuth);
  const sideX = -forwardZ;
  const sideZ = forwardX;
  const palette = treeIr.metadata.material.foliagePalette;
  const color = new THREE.Color();

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const widthEnvelope = 0.08 + 0.92 * Math.sin(Math.PI * t) ** 0.65;
    const halfWidth = frond.width * widthEnvelope * 0.5;
    const horizontalDistance = frond.length * t;
    const verticalOffset =
      frond.length * (frond.rise * t - frond.droop * 0.68 * t * t);
    const centerX = start.x + forwardX * horizontalDistance;
    const centerY = start.y + verticalOffset;
    const centerZ = start.z + forwardZ * horizontalDistance;
    setTreeIrPaletteColor(color, palette, frondColorMix(treeIr, site, t));

    for (let side = 0; side < 2; side += 1) {
      const sign = side === 0 ? -1 : 1;
      const vertexIndex = index * 2 + side;
      const offset = vertexIndex * 3;
      positions[offset] = centerX + sideX * halfWidth * sign;
      positions[offset + 1] = centerY;
      positions[offset + 2] = centerZ + sideZ * halfWidth * sign;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }

    if (index < segmentCount) {
      const left = index * 2;
      const right = left + 1;
      const nextLeft = left + 2;
      const nextRight = left + 3;
      indices.push(left, nextLeft, right, right, nextLeft, nextRight);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export class TreeIrFrondBuilder {
  build(
    treeIr,
    sites,
    {
      segmentRatio = 1,
      name = 'tree-ir-fronds',
    } = {},
  ) {
    const geometries = sites.map((site) =>
      createFrondGeometry(treeIr, site, segmentRatio),
    );
    let merged = null;
    let material = null;
    try {
      merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error('Failed to merge Tree IR frond geometry.');
      material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: Number(treeIr.metadata.material.foliageRoughness ?? 0.86),
        metalness: 0,
        fog: true,
      });
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.fronds = Object.freeze({
        count: sites.length,
        segmentRatio,
      });
      merged = null;
      material = null;
      return mesh;
    } catch (error) {
      merged?.dispose();
      material?.dispose();
      throw error;
    } finally {
      for (const geometry of geometries) geometry.dispose();
    }
  }
}
