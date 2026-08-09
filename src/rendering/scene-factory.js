import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { measureViewport } from './viewport-size.js';

function createRenderer(container, config) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const { width, height } = measureViewport(container);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, config.renderer.maxPixelRatio),
  );
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  container.appendChild(renderer.domElement);
  return renderer;
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

function createGround(config) {
  const geometry = new THREE.CircleGeometry(config.scene.groundSize * 0.5, 96);
  const material = new THREE.MeshStandardMaterial({
    color: config.scene.groundColor,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
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
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 48;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2;

  return { hemisphere, sun };
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

    const renderer = createRenderer(container, config);
    const camera = createCamera(container, config);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = config.camera.controlsMaxDistance ?? 34;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.fromArray(config.camera.target);
    controls.update();

    const { hemisphere, sun } = createLights(config);
    const ground = createGround(config);
    scene.add(hemisphere, sun, ground);

    return { scene, renderer, camera, controls, sun, ground };
  }
}
