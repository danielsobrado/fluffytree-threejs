function disposeResource(resource, disposedResources, preservedResources) {
  if (
    !resource ||
    preservedResources.has(resource) ||
    disposedResources.has(resource)
  ) {
    return;
  }

  resource.dispose?.();
  disposedResources.add(resource);
}

function disposeMaterial(material, disposedResources, preservedResources) {
  for (const resource of material.userData.disposables ?? []) {
    disposeResource(resource, disposedResources, preservedResources);
  }

  disposeResource(material, disposedResources, preservedResources);
}

export function disposeObject(root, { preserveResources = [] } = {}) {
  const disposedResources = new Set();
  const preservedResources = new Set(preserveResources);

  root.traverse((object) => {
    for (const resource of object.userData?.disposables ?? []) {
      disposeResource(resource, disposedResources, preservedResources);
    }

    disposeResource(object.geometry, disposedResources, preservedResources);

    if (Array.isArray(object.material)) {
      object.material.forEach((material) =>
        disposeMaterial(material, disposedResources, preservedResources),
      );
    } else if (object.material) {
      disposeMaterial(object.material, disposedResources, preservedResources);
    }
  });
}
