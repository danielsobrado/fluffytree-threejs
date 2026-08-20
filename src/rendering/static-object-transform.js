function validateObject3D(object) {
  if (!object || typeof object.updateMatrix !== 'function') {
    throw new TypeError('Static transform requires an Object3D-compatible object.');
  }
}

export function freezeStaticLocalTransform(object) {
  validateObject3D(object);
  object.matrixAutoUpdate = false;
  object.matrixWorldAutoUpdate = true;
  object.updateMatrix();
  return object;
}
