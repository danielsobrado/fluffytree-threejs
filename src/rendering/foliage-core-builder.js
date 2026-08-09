import * as THREE from 'three';
import { FoliageCoreGeometryFactory } from './foliage-core-geometry-factory.js';
import { createFoliageCoreLayout } from './foliage-core-layout.js';
import { FoliageCoreMaterialFactory } from './foliage-core-material-factory.js';
import { addFoliageInstanceAttributes } from './instanced-foliage-attributes.js';

const LOCAL_BRIDGE_AXIS = new THREE.Vector3(0, 1, 0);

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
    {
      paletteTexture,
      sunDirection,
      detail = 1,
      lodIndex = 0,
      scaleMultiplier = 1,
      name = 'foliage-core',
    },
  ) {
    const layout = createFoliageCoreLayout(treeData, {
      lodIndex,
      scaleMultiplier,
    });
    let geometry = null;
    let material = null;

    try {
      geometry = this.geometryFactory.create(detail);
      addFoliageInstanceAttributes(geometry, layout.instances, {
        getExposure: (instance) => instance.exposure,
        getCrownDirection: (instance) =>
          crownDirection(instance.position, treeData.crownCenter),
      });

      material = this.materialFactory.create({
        foliage: treeData.palette,
        paletteTexture,
        sunDirection,
      });
      const foliage = new THREE.InstancedMesh(
        geometry,
        material,
        layout.instances.length,
      );
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const rotation = new THREE.Euler();
      const direction = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();

      layout.instances.forEach((instance, index) => {
        position.set(
          instance.position.x,
          instance.position.y,
          instance.position.z,
        );
        if (instance.kind === 'bridge') {
          direction
            .set(
              instance.direction.x,
              instance.direction.y,
              instance.direction.z,
            )
            .normalize();
          quaternion.setFromUnitVectors(LOCAL_BRIDGE_AXIS, direction);
        } else {
          rotation.set(
            instance.rotation.x,
            instance.rotation.y,
            instance.rotation.z,
          );
          quaternion.setFromEuler(rotation);
        }
        scale.set(instance.scale.x, instance.scale.y, instance.scale.z);
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
        instanceCount: layout.instances.length,
        lobeInstanceCount: layout.lobeInstanceCount,
        bridgeInstanceCount: layout.bridgeInstanceCount,
        effectiveCoreScale: layout.effectiveCoreScale,
        profile: layout.profile,
        detail,
        lodIndex,
      };

      geometry = null;
      material = null;
      return foliage;
    } catch (error) {
      geometry?.dispose();
      material?.dispose();
      throw error;
    }
  }
}
