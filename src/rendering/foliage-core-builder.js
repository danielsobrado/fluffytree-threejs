import * as THREE from 'three';
import { FoliageCoreGeometryFactory } from './foliage-core-geometry-factory.js';
import { FoliageCoreMaterialFactory } from './foliage-core-material-factory.js';
import { addFoliageInstanceAttributes } from './instanced-foliage-attributes.js';

function crownDirection(position, center) {
  const x = position.x - center.x;
  const y = position.y - center.y;
  const z = position.z - center.z;
  const length = Math.hypot(x, y, z);

  if (length <= Number.EPSILON) {
    return { x: 0, y: 1, z: 0 };
  }

  return { x: x / length, y: y / length, z: z / length };
}

export class FoliageCoreBuilder {
  constructor({
    geometryFactory = new FoliageCoreGeometryFactory(),
    materialFactory = new FoliageCoreMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.materialFactory = materialFactory;
  }

  build(
    treeData,
    { paletteTexture, sunDirection, detail = 1, scaleMultiplier = 1, name = 'foliage-core' },
  ) {
    const geometry = this.geometryFactory.create(detail);
    addFoliageInstanceAttributes(geometry, treeData.lobes, {
      getExposure: (lobe) => treeData.lobeExposure[lobe.id] ?? 1,
      getCrownDirection: (lobe) =>
        crownDirection(lobe.position, treeData.crownCenter),
    });

    const material = this.materialFactory.create({
      foliage: treeData.palette,
      paletteTexture,
      sunDirection,
    });
    const foliage = new THREE.InstancedMesh(
      geometry,
      material,
      treeData.lobes.length,
    );
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    treeData.lobes.forEach((lobe, index) => {
      position.set(lobe.position.x, lobe.position.y, lobe.position.z);
      rotation.set(lobe.rotation.x, lobe.rotation.y, lobe.rotation.z);
      quaternion.setFromEuler(rotation);
      const coreScale = treeData.palette.core.scale * scaleMultiplier;
      scale.set(
        lobe.scale.x * coreScale,
        lobe.scale.y * coreScale,
        lobe.scale.z * coreScale,
      );
      matrix.compose(position, quaternion, scale);
      foliage.setMatrixAt(index, matrix);
    });

    foliage.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    foliage.instanceMatrix.needsUpdate = true;
    foliage.name = name;
    foliage.castShadow = false;
    foliage.receiveShadow = true;
    foliage.computeBoundingBox();
    foliage.computeBoundingSphere();
    foliage.userData.foliageCore = {
      instanceCount: treeData.lobes.length,
      detail,
    };
    return foliage;
  }
}
