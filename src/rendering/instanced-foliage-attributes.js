import * as THREE from 'three';

function createScalarAttribute(values) {
  const attribute = new THREE.InstancedBufferAttribute(
    Float32Array.from(values),
    1,
  );
  attribute.setUsage(THREE.StaticDrawUsage);
  return attribute;
}

function createVectorAttribute(values) {
  const flattened = values.flatMap((value) => [value.x, value.y, value.z]);
  const attribute = new THREE.InstancedBufferAttribute(
    Float32Array.from(flattened),
    3,
  );
  attribute.setUsage(THREE.StaticDrawUsage);
  return attribute;
}

export function addFoliageInstanceAttributes(
  geometry,
  instances,
  { getExposure, getCrownDirection },
) {
  geometry.setAttribute(
    'instanceColorMix',
    createScalarAttribute(instances.map((instance) => instance.colorMix)),
  );
  geometry.setAttribute(
    'instanceExposure',
    createScalarAttribute(
      instances.map((instance, index) => getExposure(instance, index)),
    ),
  );
  geometry.setAttribute(
    'instanceCrownDirection',
    createVectorAttribute(
      instances.map((instance, index) => getCrownDirection(instance, index)),
    ),
  );
}
