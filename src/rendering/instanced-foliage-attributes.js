import * as THREE from 'three';

function createAttribute(values) {
  const attribute = new THREE.InstancedBufferAttribute(
    Float32Array.from(values),
    1,
  );
  attribute.setUsage(THREE.StaticDrawUsage);
  return attribute;
}

export function addFoliageInstanceAttributes(
  geometry,
  instances,
  getExposure,
) {
  geometry.setAttribute(
    'instanceColorMix',
    createAttribute(instances.map((instance) => instance.colorMix)),
  );
  geometry.setAttribute(
    'instanceExposure',
    createAttribute(instances.map((instance, index) => getExposure(instance, index))),
  );
}
