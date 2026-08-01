import * as THREE from 'three';
import { CrownVolumeField } from '../generation/crown-volume-field.js';
import { LeafClusterGeometryFactory } from './leaf-cluster-geometry-factory.js';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';
import { samplePaletteColor } from './palette-color-sampler.js';

const UP = new THREE.Vector3(0, 1, 0);

function hashUnit(seed, id, salt) {
  let value = (Number(seed) ^ Math.imul(id + 1, salt)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function projectToSurface(field, sample) {
  const position = new THREE.Vector3(
    sample.position.x,
    sample.position.y,
    sample.position.z,
  );

  for (
    let iteration = 0;
    iteration < LEAF_DETAIL_RENDERING_CONSTANTS.projectionIterations;
    iteration += 1
  ) {
    const distance = field.sample(position);

    if (Math.abs(distance) <= LEAF_DETAIL_RENDERING_CONSTANTS.surfaceTolerance) {
      break;
    }

    const gradient = field.gradient(position);
    position.addScaledVector(
      new THREE.Vector3(gradient.x, gradient.y, gradient.z),
      -distance,
    );
  }

  const gradient = field.gradient(position);
  return {
    position,
    normal: new THREE.Vector3(gradient.x, gradient.y, gradient.z).normalize(),
  };
}

function selectSamples(treeData, density) {
  return treeData.shell.filter(
    (sample) => hashUnit(treeData.seed, sample.id, 0x9e3779b1) <= density,
  );
}

export class LeafClusterBuilder {
  constructor({ geometryFactory = new LeafClusterGeometryFactory() } = {}) {
    this.geometryFactory = geometryFactory;
  }

  build(treeData) {
    const settings = treeData.palette.leafDetail;
    const selected = settings.enabled
      ? selectSamples(treeData, settings.density)
      : [];

    if (selected.length === 0) {
      const empty = new THREE.Group();
      empty.name = 'leaf-detail-shell';
      return empty;
    }

    const field = new CrownVolumeField(treeData);
    const geometry = this.geometryFactory.create(settings);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness:
        settings.roughness ?? LEAF_DETAIL_RENDERING_CONSTANTS.defaultRoughness,
      metalness: LEAF_DETAIL_RENDERING_CONSTANTS.materialMetalness,
      side: THREE.DoubleSide,
    });
    material.name = 'leaf-detail-material';

    const mesh = new THREE.InstancedMesh(geometry, material, selected.length);
    const matrix = new THREE.Matrix4();
    const alignment = new THREE.Quaternion();
    const spin = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    selected.forEach((sample, index) => {
      const surface = projectToSurface(field, sample);
      const instanceScale = Math.max(
        LEAF_DETAIL_RENDERING_CONSTANTS.minimumScale,
        sample.scale * settings.scale,
      );
      alignment.setFromUnitVectors(UP, surface.normal);
      spin.setFromAxisAngle(UP, sample.rotation);
      alignment.multiply(spin);
      scale.setScalar(instanceScale);
      matrix.compose(surface.position, alignment, scale);
      mesh.setMatrixAt(index, matrix);

      const jitter =
        (hashUnit(treeData.seed, sample.id, 0x85ebca6b) * 2 - 1) *
        settings.colorJitter;
      mesh.setColorAt(
        index,
        samplePaletteColor(
          treeData.palette.palette,
          sample.colorMix + settings.colorLift + jitter,
        ),
      );
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = 'leaf-detail-shell';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.leafDetail = {
      clusterCount: selected.length,
      leafCount: selected.length * settings.leavesPerCluster,
    };
    return mesh;
  }
}
