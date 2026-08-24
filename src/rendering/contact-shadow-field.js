import * as THREE from 'three';
import {
  resolveContactShadowFootprint,
  resolveContactShadowSettings,
} from './contact-shadow-layout.js';

/**
 * Every tree's ground pool, in one draw call.
 *
 * One instanced quad per tree, sharing a single gradient texture and a single
 * multiply-blended material. Multiply is what makes this cheap and correct at
 * once: the pool darkens whatever the ground already is — grass, a light pool,
 * another tree's shade — without needing to be sorted against it, and the
 * gradient's white rim multiplies to nothing, so there is no edge.
 *
 * Instances are filled in as trees are built, because a large forest builds its
 * trees over many frames through the generation budget and a pool that waited
 * for the last of them would pop in long after the trees did.
 */

const TEXTURE_RESOLUTION = 64;

function createGradientTexture(strength) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_RESOLUTION;
  canvas.height = TEXTURE_RESOLUTION;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create the contact shadow texture canvas.');
  }
  const centre = TEXTURE_RESOLUTION * 0.5;
  const gradient = context.createRadialGradient(
    centre,
    centre,
    0,
    centre,
    centre,
    centre,
  );
  // A linear ramp reads as a disc with a halo around it. Stopping the falloff
  // short of half strength by the midpoint gives a pool with no edge to find.
  const stop = (fraction) => {
    const level = Math.round(255 * (1 - strength * fraction));
    return `rgb(${level}, ${level}, ${level})`;
  };

  gradient.addColorStop(0, stop(1));
  gradient.addColorStop(0.55, stop(0.42));
  gradient.addColorStop(1, stop(0));
  context.fillStyle = gradient;
  context.fillRect(0, 0, TEXTURE_RESOLUTION, TEXTURE_RESOLUTION);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class ContactShadowField {
  constructor(scene, config) {
    this.scene = scene;
    this.settings = resolveContactShadowSettings(config);
    this.texture = this.settings.enabled
      ? createGradientTexture(this.settings.strength)
      : null;
    this.material = this.settings.enabled
      ? new THREE.MeshBasicMaterial({
          map: this.texture,
          blending: THREE.MultiplyBlending,
          depthWrite: false,
          // The pool is shade, not a surface: fogging it would blend the fog
          // colour in and turn a distant pool into a bright disc.
          fog: false,
          toneMapped: false,
        })
      : null;
    this.mesh = null;
    this.matrix = new THREE.Matrix4();
  }

  /** Clears the field and sizes it for the layout about to be built. */
  reset(capacity) {
    this.dispose();
    if (!this.settings.enabled || capacity <= 0) return;

    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    this.mesh.name = 'contact-shadows';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    // Drawn after the ground so it has something to multiply into, and it
    // writes no depth, so it never occludes anything standing in it.
    this.mesh.renderOrder = 1;
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;
    this.scene.add(this.mesh);
  }

  /** Places the pool for one tree, from that tree's own crown footprint. */
  add({ bounds, position, rotationY, scale }) {
    if (!this.mesh || this.mesh.count >= this.mesh.instanceMatrix.count) return;

    const footprint = resolveContactShadowFootprint(
      { bounds, position, rotationY, scale },
      this.settings,
    );
    const diameter = footprint.radius * 2;

    this.matrix.makeScale(diameter, 1, diameter);
    this.matrix.setPosition(footprint.x, this.settings.height, footprint.z);
    this.mesh.setMatrixAt(this.mesh.count, this.matrix);
    this.mesh.count += 1;
    this.mesh.instanceMatrix.needsUpdate = true;
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
