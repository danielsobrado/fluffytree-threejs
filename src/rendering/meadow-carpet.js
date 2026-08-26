import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMeadowScatter, resolveMeadowSettings } from './meadow-scatter.js';
import { applyWoodWind, createTreeWindState } from './tree-wind-shader.js';

/**
 * The meadow, as one instanced draw.
 *
 * A tuft is a pair of crossed quads — four triangles — so it holds a silhouette
 * from any angle without ever being sorted or turned to face the camera. The
 * alpha map is one shared canvas of a few tapered blades with a couple of
 * florets near the top; whether an instance reads as grass or as a flower is
 * carried entirely by its colour, which is what keeps the whole carpet inside a
 * single draw call.
 *
 * The wind is the tree wind's wood ramp, rooted at the tuft's own height, so
 * the blades bend from a planted base in step with the canopy above them
 * instead of drifting on their own clock. Registering the mesh with the wind
 * controller is what feeds it time, and what freezes it under `?wind=off`.
 */

const TEXTURE_RESOLUTION = 64;
const TUFT_HEIGHT = 1;

function paintBlade(context, baseX, tipX, width, height) {
  context.beginPath();
  context.moveTo(baseX - width, TEXTURE_RESOLUTION);
  context.quadraticCurveTo(
    baseX - width * 0.4,
    TEXTURE_RESOLUTION - height * 0.5,
    tipX,
    TEXTURE_RESOLUTION - height,
  );
  context.quadraticCurveTo(
    baseX + width * 0.4,
    TEXTURE_RESOLUTION - height * 0.5,
    baseX + width,
    TEXTURE_RESOLUTION,
  );
  context.closePath();
  context.fill();
}

function createTuftTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_RESOLUTION;
  canvas.height = TEXTURE_RESOLUTION;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the meadow texture canvas.');
  context.clearRect(0, 0, TEXTURE_RESOLUTION, TEXTURE_RESOLUTION);
  context.fillStyle = '#ffffff';

  paintBlade(context, 32, 30, 5, 58);
  paintBlade(context, 24, 12, 4, 44);
  paintBlade(context, 40, 52, 4, 40);
  paintBlade(context, 29, 20, 3, 26);
  context.beginPath();
  context.arc(30, 8, 5, 0, Math.PI * 2);
  context.arc(50, 26, 3.6, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createTuftGeometry() {
  const first = new THREE.PlaneGeometry(1, TUFT_HEIGHT);
  first.translate(0, TUFT_HEIGHT * 0.5, 0);

  const second = first.clone();
  second.rotateY(Math.PI / 2);

  return mergeGeometries([first, second]);
}

export class MeadowCarpet {
  constructor(scene, config) {
    this.scene = scene;
    this.settings = resolveMeadowSettings(config);
    this.mesh = null;
    this.texture = null;
    this.material = null;
  }

  build(radius = this.settings.radius) {
    this.dispose();
    if (!this.settings.enabled || this.settings.count === 0 || radius <= 0) {
      return;
    }

    const instances = createMeadowScatter({ ...this.settings, radius });
    this.texture ??= createTuftTexture();
    this.material ??= new THREE.MeshLambertMaterial({
      map: this.texture,
      alphaTest: 0.5,
      transparent: false,
      side: THREE.DoubleSide,
    });
    this.material.userData.windState ??= createTreeWindState();
    const windState = this.material.userData.windState;
    this.material.onBeforeCompile = (shader) => {
      applyWoodWind(shader, windState, TUFT_HEIGHT);
    };

    const mesh = new THREE.InstancedMesh(
      createTuftGeometry(),
      this.material,
      instances.length,
    );
    mesh.name = 'meadow';
    mesh.userData.tree = { height: TUFT_HEIGHT };
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = true;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const colour = new THREE.Color();

    for (const [index, instance] of instances.entries()) {
      quaternion.setFromAxisAngle(upAxis, instance.rotationY);
      position.set(instance.x, 0, instance.z);
      scale.setScalar(instance.scale);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, colour.set(instance.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();

    this.mesh = mesh;
    this.scene.add(mesh);
    return mesh;
  }

  dispose() {
    if (!this.mesh) return;

    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh = null;
  }

  disposeShared() {
    this.dispose();
    this.material?.dispose();
    this.texture?.dispose();
    this.material = null;
    this.texture = null;
  }
}
