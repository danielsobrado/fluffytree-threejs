function disposeMaterial(material, disposedResources) {
  for (const resource of material.userData.disposables ?? []) {
    if (!disposedResources.has(resource)) {
      resource.dispose();
      disposedResources.add(resource);
    }
  }

  if (!disposedResources.has(material)) {
    material.dispose();
    disposedResources.add(material);
  }
}

export function disposeObject(root) {
  const disposedResources = new Set();

  root.traverse((object) => {
    if (object.geometry && !disposedResources.has(object.geometry)) {
      object.geometry.dispose();
      disposedResources.add(object.geometry);
    }

    if (Array.isArray(object.material)) {
      object.material.forEach((material) =>
        disposeMaterial(material, disposedResources),
      );
    } else if (object.material) {
      disposeMaterial(object.material, disposedResources);
    }
  });
}
