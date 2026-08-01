import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js';

export class CrownShadowProxyBuilder {
  build(treeData) {
    const geometry = new THREE.IcosahedronGeometry(
      1,
      FOLIAGE_RENDERING_CONSTANTS.shadowLobeDetail,
    );
    geometry.name = 'crown-shadow-proxy-geometry';

    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    material.name = 'crown-shadow-proxy-material';
    material.colorWrite = false;
    material.depthWrite = false;

    const proxy = new THREE.InstancedMesh(
      geometry,
      material,
      treeData.lobes.length,
    );
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const proxyScale = treeData.palette.shell.shadowProxyScale;

    treeData.lobes.forEach((lobe, index) => {
      position.set(lobe.position.x, lobe.position.y, lobe.position.z);
      rotation.set(lobe.rotation.x, lobe.rotation.y, lobe.rotation.z);
      quaternion.setFromEuler(rotation);
      scale.set(
        lobe.scale.x * proxyScale,
        lobe.scale.y * proxyScale,
        lobe.scale.z * proxyScale,
      );
      matrix.compose(position, quaternion, scale);
      proxy.setMatrixAt(index, matrix);
    });

    proxy.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    proxy.instanceMatrix.needsUpdate = true;
    proxy.name = 'crown-shadow-proxy';
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    proxy.renderOrder = -1;
    proxy.computeBoundingBox();
    proxy.computeBoundingSphere();
    return proxy;
  }
}
