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

export function freezeStaticSubtree(root) {
  validateObject3D(root);
  if (
    typeof root.traverse !== 'function' ||
    typeof root.updateMatrixWorld !== 'function'
  ) {
    throw new TypeError('Static subtree requires a traversable Object3D-compatible object.');
  }

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
    object.matrixWorldNeedsUpdate = false;
  });
  return root;
}
