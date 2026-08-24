import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { DepthOfFieldPass } from './depth-of-field-pass.js';
import { resolveDepthOfFieldSettings } from './depth-of-field-math.js';

/**
 * The storybook grade: a lens that holds one band of the scene in focus, a
 * little bloom on the brightest foliage, a gentle vignette, and a touch of
 * saturation.
 *
 * The depth of field runs first, because it is what the lens does to the light
 * before anything else in the chain sees it: a blurred highlight should bloom
 * as the soft shape it has become, not as the pinpoint it was.
 *
 * The chain renders into a multisampled target, because the canopy is
 * alpha-to-coverage geometry whose edges are resolved by the multisampling
 * itself. Rendering it into a single-sampled buffer would hand the grade a
 * canopy with hard cut-out edges, which is the look the whole foliage pipeline
 * exists to avoid.
 *
 * Tone mapping moves into `OutputPass` on its own: three.js disables a
 * material's tone mapping whenever it draws into a render target, so the scene
 * pass already writes linear values and the bloom threshold means something.
 * The renderer's own `toneMapping` is what `OutputPass` reads to decide which
 * curve to apply, so it is left exactly as the scene factory set it.
 *
 * UnrealBloomPass performs its own half-resolution downsampling internally.
 */

const BLOOM_THRESHOLD = 0.82;
const BLOOM_STRENGTH = 0.28;
const BLOOM_RADIUS = 0.55;

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uVignetteStrength: { value: 0.12 },
    uSaturation: { value: 1.06 },
    uShadowLift: { value: 0.015 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignetteStrength;
    uniform float uSaturation;
    uniform float uShadowLift;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D( tDiffuse, vUv );
      vec3 color = texel.rgb;

      float luminance = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      color = mix( vec3( luminance ), color, uSaturation );
      // Warm the darkest values rather than letting them fall to neutral, so
      // shadows read as sky-lit shade instead of absence of light.
      color += vec3( 0.9, 1.0, 1.15 ) * uShadowLift * ( 1.0 - luminance );

      vec2 offset = vUv - 0.5;
      float vignette = 1.0 - uVignetteStrength * dot( offset, offset ) * 4.0;

      gl_FragColor = vec4( clamp( color * vignette, 0.0, 1.0 ), texel.a );
    }
  `,
};

/**
 * The depth of field reads the depth the scene pass wrote, so both sides of the
 * composer's ping-pong need their own depth texture: either one of them can be
 * the buffer the scene was last drawn into. Cloning the target would hand the
 * two framebuffers the same texture to attach.
 */
export function attachDepthTexture(target) {
  target.depthTexture?.dispose();
  target.depthTexture = new THREE.DepthTexture(target.width, target.height);
  return target.depthTexture;
}

export function createPostPipeline({
  renderer,
  scene,
  camera,
  container,
  depthOfField,
}) {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    samples: 4,
    // A depth texture cannot be resolved out of a packed depth-stencil
    // multisample buffer, and nothing in the chain stencils.
    stencilBuffer: false,
  });
  const focusSettings = resolveDepthOfFieldSettings(depthOfField);
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);

  if (focusSettings.enabled) {
    attachDepthTexture(composer.renderTarget1);
    attachDepthTexture(composer.renderTarget2);
  }

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  );
  const depthOfFieldPass = focusSettings.enabled
    ? new DepthOfFieldPass(camera, focusSettings)
    : null;

  composer.addPass(new RenderPass(scene, camera));
  if (depthOfFieldPass) composer.addPass(depthOfFieldPass);
  composer.addPass(bloom);
  // Applies the tone mapping the renderer no longer does, then the grade sits
  // after it so the vignette is applied in display space.
  const outputPass = new OutputPass();
  const gradePass = new ShaderPass(GRADE_SHADER);
  composer.addPass(outputPass);
  composer.addPass(gradePass);

  return {
    focusSettings,
    render() {
      composer.render();
    },
    /** The distance the lens holds sharp; the scene decides it per frame. */
    setFocusDistance(distance) {
      depthOfFieldPass?.setFocusDistance(distance);
    },
    setSize(nextWidth, nextHeight) {
      // EffectComposer sizes its render targets and every pass at the active
      // pixel ratio. WebGLRenderTarget also resizes attached depth textures.
      composer.setSize(nextWidth, nextHeight);
    },
    dispose() {
      depthOfFieldPass?.dispose();
      bloom.dispose();
      outputPass.dispose();
      gradePass.dispose();
      composer.dispose();
    },
  };
}
