import * as THREE from 'three';
import { addFoliageInstanceAttributes } from './instanced-foliage-attributes.js?v=2.0.0-20260814.2';

const LOCAL_OUTWARD = new THREE.Vector3(0, 0, 1);

function crownDirection(position, center, result) {
  const x = position.x - center.x;
  const y = position.y - center.y;
  const z = position.z - center.z;
  const length = Math.hypot(x, y, z);

  if (length <= Number.EPSILON) {
    result.x = 0;
    result.y = 1;
    result.z = 0;
    return result;
  }

  result.x = x / length;
  result.y = y / length;
  result.z = z / length;
  return result;
}

export function buildFoliageShellInstanceMesh(
  treeData,
  geometry,
  material,
  instances,
  {
    scaleMultiplier,
    name,
  },
) {
  addFoliageInstanceAttributes(geometry, instances, {
    getExposure: (instance) => instance.exposure,
    getCrownDirection: (instance, _index, target) =>
      crownDirection(instance.position, treeData.crownCenter, target),
  });

  const shell = new THREE.InstancedMesh(
    geometry,
    material,
    instances.length,
  );
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const twist = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  instances.forEach((instance, index) => {
    position.set(
      instance.position.x,
      instance.position.y,
      instance.position.z,
    );
    normal
      .set(instance.normal.x, instance.normal.y, instance.normal.z)
      .normalize();
    quaternion.setFromUnitVectors(LOCAL_OUTWARD, normal);
    twist.setFromAxisAngle(LOCAL_OUTWARD, instance.rotation);
    quaternion.multiply(twist);
    const shellScale = instance.shellScale ?? instance.scale;
    scale.set(
      shellScale * instance.widthRatio * scaleMultiplier,
      shellScale * instance.widthRatio * scaleMultiplier,
      shellScale * instance.outwardRatio * scaleMultiplier,
    );
    matrix.compose(position, quaternion, scale);
    shell.setMatrixAt(index, matrix);
  });

  shell.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  shell.instanceMatrix.needsUpdate = true;
  shell.name = name;
  shell.castShadow = false;
  shell.receiveShadow = true;
  shell.renderOrder = 1;
  shell.computeBoundingBox();
  shell.computeBoundingSphere();
  return shell;
}
