import * as THREE from 'three';

function createScalarAttribute(instances, getValue) {
  const values = new Float32Array(instances.length);
  for (let index = 0; index < instances.length; index += 1) {
    values[index] = getValue(instances[index], index);
  }

  const attribute = new THREE.InstancedBufferAttribute(values, 1);
  attribute.setUsage(THREE.StaticDrawUsage);
  return attribute;
}

function createVectorAttribute(instances, getValue) {
  const values = new Float32Array(instances.length * 3);
  const target = { x: 0, y: 0, z: 0 };

  for (let index = 0; index < instances.length; index += 1) {
    const value = getValue(instances[index], index, target);
    const offset = index * 3;
    values[offset] = value.x;
    values[offset + 1] = value.y;
    values[offset + 2] = value.z;
  }

  const attribute = new THREE.InstancedBufferAttribute(values, 3);
  attribute.setUsage(THREE.StaticDrawUsage);
  return attribute;
}

export function addFoliageInstanceAttributes(
  geometry,
  instances,
  {
    getColorMix = (instance) => instance.colorMix,
    getExposure,
    getCrownDirection,
  },
) {
  geometry.setAttribute(
    'instanceColorMix',
    createScalarAttribute(instances, getColorMix),
  );
  geometry.setAttribute(
    'instanceExposure',
    createScalarAttribute(instances, getExposure),
  );
  geometry.setAttribute(
    'instanceCrownDirection',
    createVectorAttribute(instances, getCrownDirection),
  );
}
