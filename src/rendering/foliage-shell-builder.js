import * as THREE from 'three';
import { FoliageShellGeometryFactory } from './foliage-shell-geometry-factory.js';
import { FoliageShellMaterialFactory } from './foliage-shell-material-factory.js';
import { addFoliageInstanceAttributes } from './instanced-foliage-attributes.js';

const LOCAL_OUTWARD = new THREE.Vector3(0, 0, 1);

export class FoliageShellBuilder {
  constructor({
    geometryFactory = new FoliageShellGeometryFactory(),
    materialFactory = new FoliageShellMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.materialFactory = materialFactory;
  }

  build(treeData, { paletteTexture, alphaTexture, sunDirection }) {
    const geometry = this.geometryFactory.create(
      treeData.palette.shell.planesPerCluster,
    );
    addFoliageInstanceAttributes(
      geometry,
      treeData.shell,
      (instance) => instance.exposure,
    );

    const material = this.materialFactory.create({
      foliage: treeData.palette,
      paletteTexture,
      alphaTexture,
      sunDirection,
    });
    const shell = new THREE.InstancedMesh(
      geometry,
      material,
      treeData.shell.length,
    );
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const twist = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    treeData.shell.forEach((instance, index) => {
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
      scale.setScalar(instance.scale);
      matrix.compose(position, quaternion, scale);
      shell.setMatrixAt(index, matrix);
    });

    shell.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    shell.instanceMatrix.needsUpdate = true;
    shell.name = 'foliage-shell';
    shell.castShadow = false;
    shell.receiveShadow = true;
    shell.renderOrder = 1;
    shell.computeBoundingBox();
    shell.computeBoundingSphere();
    return shell;
  }
}
