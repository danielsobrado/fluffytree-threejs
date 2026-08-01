import * as THREE from 'three';
import { BranchMeshBuilder } from './branch-mesh-builder.js';

const LOBE_DETAIL = 2;
const LOBE_ROUGHNESS = 0.96;
const LOBE_DEFORMATION = 0.055;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function createLobeGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, LOBE_DETAIL);
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index);
    const deformation =
      1 +
      Math.sin(vertex.x * 7.1 + vertex.y * 4.7) * LOBE_DEFORMATION +
      Math.sin(vertex.z * 6.3 - vertex.y * 3.9) * LOBE_DEFORMATION * 0.6;
    vertex.multiplyScalar(deformation);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createLobeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: LOBE_ROUGHNESS,
    metalness: 0,
  });
}

function createLobeColor(palette, colorMix) {
  const base = new THREE.Color(palette.baseColor);
  const light = new THREE.Color(palette.lightColor);
  const variation = (colorMix - 0.5) * palette.variation;
  const mix = clamp01(0.34 + colorMix * 0.48 + variation);
  return base.lerp(light, mix);
}

export class TreeMeshBuilder {
  constructor({ branchMeshBuilder = new BranchMeshBuilder() } = {}) {
    this.branchMeshBuilder = branchMeshBuilder;
  }

  build(treeData) {
    const group = new THREE.Group();
    group.name = `tree-${treeData.presetId}`;
    group.userData.tree = {
      presetId: treeData.presetId,
      seed: treeData.seed,
      height: treeData.height,
    };

    const structure = this.branchMeshBuilder.build(treeData);
    const geometry = createLobeGeometry();
    const material = createLobeMaterial();
    const foliage = new THREE.InstancedMesh(geometry, material, treeData.lobes.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    treeData.lobes.forEach((lobe, index) => {
      position.set(lobe.position.x, lobe.position.y, lobe.position.z);
      rotation.set(lobe.rotation.x, lobe.rotation.y, lobe.rotation.z);
      quaternion.setFromEuler(rotation);
      scale.set(lobe.scale.x, lobe.scale.y, lobe.scale.z);
      matrix.compose(position, quaternion, scale);
      foliage.setMatrixAt(index, matrix);
      foliage.setColorAt(index, createLobeColor(treeData.palette, lobe.colorMix));
    });

    foliage.instanceMatrix.needsUpdate = true;

    if (foliage.instanceColor) {
      foliage.instanceColor.needsUpdate = true;
    }

    foliage.name = 'foliage-core';
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    foliage.computeBoundingBox();
    foliage.computeBoundingSphere();

    group.add(structure, foliage);
    return group;
  }
}
