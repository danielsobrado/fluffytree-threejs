import * as THREE from 'three';
import { setObjectLodFade } from './lod-dither-fade.js';

/**
 * Captures a level of detail into an impostor texture by rendering it.
 *
 * A painted impostor approximates the tree from its lobes and trunk path, and
 * the approximation drifts from the geometry it replaces once perspective is
 * applied. That drift is what opens gaps during the crossfade, and it is worst
 * on trunks that travel a long way sideways, because a flat billboard cannot
 * track them. Rendering the level the impostor swaps with removes the drift
 * rather than compensating for it.
 *
 * The camera is orthographic and framed on exactly the layout the sprite uses,
 * so the captured pixels land where the painted ones did.
 */
export class TreeImpostorRenderer {
  constructor(renderer, { textureSize = 128 } = {}) {
    if (!renderer) throw new Error('An impostor renderer requires a WebGLRenderer.');

    this.renderer = renderer;
    this.textureSize = textureSize;
    this.target = new THREE.WebGLRenderTarget(textureSize, textureSize);
    this.pixels = new Uint8Array(textureSize * textureSize * 4);
    this.camera = new THREE.OrthographicCamera();
    this.scene = new THREE.Scene();
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
  }

  /** Lights are rebuilt per capture so the impostor matches the lit scene. */
  configureLights(sunDirection, lighting) {
    if (this.lights) this.scene.remove(...this.lights);

    const hemisphere = new THREE.HemisphereLight(
      lighting.hemisphereSkyColor,
      lighting.hemisphereGroundColor,
      lighting.hemisphereIntensity,
    );
    const sun = new THREE.DirectionalLight(
      lighting.sunColor,
      lighting.sunIntensity,
    );
    sun.position.copy(sunDirection).multiplyScalar(100);
    this.lights = [hemisphere, sun];
    this.scene.add(...this.lights);
  }

  /**
   * Renders `level` from the direction the sprite faces and returns a canvas
   * holding the result. The level is borrowed, not consumed: its parent, fade
   * and transform are restored before returning.
   */
  capture(level, layout, rotationY) {
    const previousParent = level.parent;
    const previousRotation = level.rotation.y;
    const previousFade = level.visible;

    this.holder.add(level);
    this.holder.rotation.y = 0;
    level.rotation.y = 0;
    // The level normally renders faded out; the capture needs it whole.
    setObjectLodFade(level, 1);

    const half = layout.worldSize * 0.5;
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.near = 0.01;
    this.camera.far = layout.worldSize * 4 + 100;
    this.camera.updateProjectionMatrix();

    // The layout projects the tree after rotating it about Y, so the camera sits
    // on the matching side and looks back along that direction.
    const distance = layout.worldSize * 2 + 10;
    const anchor = new THREE.Vector3(
      layout.anchor.x,
      layout.anchor.y,
      layout.anchor.z,
    );
    this.camera.position
      .set(Math.sin(-rotationY), 0, Math.cos(-rotationY))
      .multiplyScalar(distance)
      .add(anchor);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(anchor);
    this.camera.updateMatrixWorld(true);

    const previousTarget = this.renderer.getRenderTarget();
    const previousClear = this.renderer.getClearColor(new THREE.Color());
    const previousAlpha = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(
      this.target,
      0,
      0,
      this.textureSize,
      this.textureSize,
      this.pixels,
    );
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(previousClear, previousAlpha);

    this.holder.remove(level);
    level.rotation.y = previousRotation;
    level.visible = previousFade;
    if (previousParent) previousParent.add(level);

    return this.createCanvas();
  }

  /** Read-back rows run bottom-up, so the copy flips them. */
  createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = this.textureSize;
    canvas.height = this.textureSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create the impostor canvas.');

    const image = context.createImageData(this.textureSize, this.textureSize);
    const rowBytes = this.textureSize * 4;
    for (let row = 0; row < this.textureSize; row += 1) {
      const source = row * rowBytes;
      const destination = (this.textureSize - 1 - row) * rowBytes;
      image.data.set(
        this.pixels.subarray(source, source + rowBytes),
        destination,
      );
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  dispose() {
    this.target.dispose();
  }
}
