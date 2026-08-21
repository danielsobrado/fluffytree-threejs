import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE_RUNTIME_CONSTANTS } from '../config/scene-runtime-constants.js?v=2.0.0-20260814.2';
import {
  applyGroundPool,
  resolveGroundPoolSettings,
} from './ground-light-pools.js?v=2.0.0-20260814.2';
import { disposeObject } from './object-disposer.js?v=2.0.0-20260814.2';
import { measureViewport } from './viewport-size.js?v=2.0.0-20260814.2';

function createRenderer(container, config) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });

  try {
    const { width, height } = measureViewport(container);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, config.renderer.maxPixelRatio),
    );
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    container.appendChild(renderer.domElement);
    return renderer;
  } catch (error) {
    renderer.dispose();
    renderer.domElement?.remove?.();
    throw error;
  }
}

function createCamera(container, config) {
  const { width, height } = measureViewport(container);
  const camera = new THREE.PerspectiveCamera(
    config.camera.fieldOfView,
    width / height,
    config.camera.near,
    config.camera.far,
  );
  camera.position.fromArray(config.camera.position);
  return camera;
}

const DEFAULT_SHADOW_EXTENT = 16;
const GROUND_SEGMENTS = 128;
const GROUND_RING_SPACING = 2.5;
const MINIMUM_GROUND_RINGS = 16;
const MAXIMUM_GROUND_RINGS = 64;

/**
 * A disc of rings rather than a single fan.
 *
 * A CircleGeometry is a centre vertex and a rim, which is all the ground ever
 * needed while it was one flat colour. Light pools are carried on the vertices,
 * so the disc now has to have some.
 */
function createGroundGeometry(config) {
  const radius = config.scene.groundSize * 0.5;
  const rings = Math.min(
    MAXIMUM_GROUND_RINGS,
    Math.max(MINIMUM_GROUND_RINGS, Math.round(radius / GROUND_RING_SPACING)),
  );
  const geometry = new THREE.RingGeometry(0, radius, GROUND_SEGMENTS, rings);

  paintGroundPools(geometry, config);
  return geometry;
}

/**
 * Bakes the meadow's broad variation into the ground's own vertex colours.
 *
 * The geometry is still in its own XY plane at this point — the mesh is what
 * lays it down — so the noise is sampled over x and y, and the mesh's rotation
 * is what makes that the ground plane.
 */
function paintGroundPools(geometry, config) {
  const settings = resolveGroundPoolSettings(config.scene.lightPools);
  const positions = geometry.getAttribute('position');
  const base = new THREE.Color(config.scene.groundColor);
  const colours = new Float32Array(positions.count * 3);

  for (let index = 0; index < positions.count; index += 1) {
    const pooled = applyGroundPool(
      base,
      positions.getX(index),
      positions.getY(index),
      settings,
    );
    colours[index * 3] = pooled.r;
    colours[index * 3 + 1] = pooled.g;
    colours[index * 3 + 2] = pooled.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}

function createGround(config) {
  const geometry = createGroundGeometry(config);
  let material = null;

  try {
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.name = 'ground';
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    return ground;
  } catch (error) {
    geometry.dispose();
    material?.dispose();
    throw error;
  }
}

/**
 * The shadow frustum for a scene of this size.
 *
 * A garden fits inside a small box around the origin. A forest does not, so the
 * extent grows with the scene and the sun is moved to follow the viewer; the
 * frustum has to be deep enough to hold the sun at that distance.
 */
function applyShadowFrustum(sun, config) {
  const extent = config.lighting.shadowExtent ?? DEFAULT_SHADOW_EXTENT;
  const camera = sun.shadow.camera;

  camera.left = -extent;
  camera.right = extent;
  camera.top = extent;
  camera.bottom = -extent * 0.5;
  camera.near = 1;
  camera.far = extent * 3;
  camera.updateProjectionMatrix();
}

function createLights(config) {
  const hemisphere = new THREE.HemisphereLight(
    config.lighting.hemisphereSkyColor,
    config.lighting.hemisphereGroundColor,
    config.lighting.hemisphereIntensity,
  );
  const sun = new THREE.DirectionalLight(
    config.lighting.sunColor,
    config.lighting.sunIntensity,
  );

  sun.name = 'sun';
  sun.position.fromArray(config.lighting.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(
    config.renderer.shadowMapSize,
    config.renderer.shadowMapSize,
  );
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 5;
  applyShadowFrustum(sun, config);

  return { hemisphere, sun };
}

/**
 * Re-dresses a live scene for a different layout.
 *
 * Switching scenes keeps the renderer, its compiled programs and the impostor
 * capture target, so only what the configuration actually describes changes:
 * the fog, the ground disc, the camera, and how far the shadow reaches. The sun
 * returns to its configured place, which is where a scene that does not follow
 * the viewer expects to find it.
 */
export function applySceneSettings(context, config) {
  const { scene, camera, controls, sun, hemisphere } = context;

  scene.background.set(config.scene.backgroundColor);
  scene.fog.color.set(config.scene.fogColor);
  scene.fog.near = config.scene.fogNear;
  scene.fog.far = config.scene.fogFar;

  const ground = scene.getObjectByName('ground');
  if (ground) {
    ground.geometry.dispose();
    ground.geometry = createGroundGeometry(config);
  }

  camera.fov = config.camera.fieldOfView;
  camera.near = config.camera.near;
  camera.far = config.camera.far;
  camera.position.fromArray(config.camera.position);
  camera.updateProjectionMatrix();

  controls.maxDistance = config.camera.controlsMaxDistance ?? 34;
  controls.target.fromArray(config.camera.target);
  controls.update();

  hemisphere.color.set(config.lighting.hemisphereSkyColor);
  hemisphere.groundColor.set(config.lighting.hemisphereGroundColor);
  hemisphere.intensity = config.lighting.hemisphereIntensity;
  sun.color.set(config.lighting.sunColor);
  sun.intensity = config.lighting.sunIntensity;
  sun.position.fromArray(config.lighting.sunPosition);
  sun.target.position.set(0, 0, 0);
  sun.target.updateMatrixWorld();
  applyShadowFrustum(sun, config);
  context.renderer.shadowMap.needsUpdate = true;
}

export class SceneFactory {
  create(container, config) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.scene.backgroundColor);
    scene.fog = new THREE.Fog(
      config.scene.fogColor,
      config.scene.fogNear,
      config.scene.fogFar,
    );

    let renderer = null;
    let controls = null;
    let ground = null;

    try {
      renderer = createRenderer(container, config);
      const camera = createCamera(container, config);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = SCENE_RUNTIME_CONSTANTS.minimumOrbitDistance;
      controls.maxDistance = config.camera.controlsMaxDistance ?? 34;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.target.fromArray(config.camera.target);
      controls.update();

      const { hemisphere, sun } = createLights(config);
      ground = createGround(config);
      scene.add(hemisphere, sun, sun.target, ground);

      return { scene, renderer, camera, controls, sun, ground, hemisphere };
    } catch (error) {
      controls?.dispose();
      if (ground) disposeObject(ground);
      renderer?.dispose();
      renderer?.domElement?.remove?.();
      throw error;
    }
  }
}
