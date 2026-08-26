import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { createGoldenAngleDiskKernel } from './depth-of-field-kernel.js';

/**
 * The lens blur, as one pass over the scene's own depth.
 *
 * three.js ships `BokehPass`, which draws the whole scene a second time with a
 * depth material to get the depth it needs. A forest of alpha-tested cards is
 * the last scene that can afford being drawn twice, so this pass reads the
 * depth buffer the scene pass already filled instead: the composer's targets
 * carry a depth texture, and `render` is handed the very buffer the previous
 * pass wrote, so there is no guessing about which side of the ping-pong the
 * scene currently lives on.
 *
 * The kernel is a golden-angle spiral rather than a separable Gaussian. A
 * per-pixel blur radius is not separable — running it as two passes smears
 * sharp subjects horizontally before the vertical pass can stop it — and a
 * disc is what a lens actually does. Sixteen taps is enough because the input
 * is a soft painterly canopy, and pixels inside the sharp band take none of
 * them.
 */

const TAP_COUNT = 16;
const TAP_OFFSETS = createGoldenAngleDiskKernel(TAP_COUNT).map(
  ([x, y]) => new THREE.Vector2(x, y),
);

const DEPTH_OF_FIELD_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uNear: { value: 0.1 },
    uFar: { value: 120 },
    uFocusDistance: { value: 18 },
    uFocusRange: { value: 4.5 },
    uNearFalloff: { value: 5 },
    uFarFalloff: { value: 26 },
    uBlurRadius: { value: 0.011 },
    uAspect: { value: 1 },
    uTapOffsets: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: `
    #include <packing>

    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float uNear;
    uniform float uFar;
    uniform float uFocusDistance;
    uniform float uFocusRange;
    uniform float uNearFalloff;
    uniform float uFarFalloff;
    uniform float uBlurRadius;
    uniform float uAspect;
    uniform vec2 uTapOffsets[${TAP_COUNT}];
    varying vec2 vUv;

    const int TAP_COUNT = ${TAP_COUNT};

    float sceneDistance( vec2 uv ) {
      float depth = texture2D( tDepth, uv ).x;
      // Sky writes the far plane, so it blurs like anything else that far away,
      // which is what the reference does to its background.
      return -perspectiveDepthToViewZ( depth, uNear, uFar );
    }

    float circleOfConfusion( float distance ) {
      float gap = distance - uFocusDistance;
      float falloff = gap < 0.0 ? uNearFalloff : uFarFalloff;
      float beyondSharp = max( abs( gap ) - uFocusRange, 0.0 );

      return clamp( beyondSharp / falloff, 0.0, 1.0 );
    }

    void main() {
      float centreCoc = circleOfConfusion( sceneDistance( vUv ) );

      if ( centreCoc <= 0.002 ) {
        gl_FragColor = texture2D( tDiffuse, vUv );
        return;
      }

      // The radius is a fraction of frame height in both axes, so the disc
      // stays a circle on screen instead of stretching with the aspect.
      vec2 radius = vec2( uBlurRadius / uAspect, uBlurRadius ) * centreCoc;
      vec4 total = texture2D( tDiffuse, vUv );
      float weight = 1.0;

      for ( int i = 0; i < TAP_COUNT; i ++ ) {
        vec2 tapUv = vUv + uTapOffsets[i] * radius;
        float tapCoc = circleOfConfusion( sceneDistance( tapUv ) );
        // A sharp subject must not bleed outwards into the blur behind it, so a
        // tap only contributes if it is itself close to as defocused as here.
        float accepted = step( centreCoc * 0.6, tapCoc );

        total += texture2D( tDiffuse, tapUv ) * accepted;
        weight += accepted;
      }

      gl_FragColor = total / weight;
    }
  `,
};

export class DepthOfFieldPass extends Pass {
  constructor(camera, settings) {
    super();
    this.camera = camera;
    this.settings = settings;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(DEPTH_OF_FIELD_SHADER.uniforms),
      vertexShader: DEPTH_OF_FIELD_SHADER.vertexShader,
      fragmentShader: DEPTH_OF_FIELD_SHADER.fragmentShader,
    });
    this.quad = new FullScreenQuad(this.material);
    this.needsSwap = true;

    const { uniforms } = this.material;
    uniforms.uFocusRange.value = settings.focusRange;
    uniforms.uNearFalloff.value = settings.nearFalloff;
    uniforms.uFarFalloff.value = settings.farFalloff;
    uniforms.uBlurRadius.value = settings.blurRadius;
    uniforms.uTapOffsets.value = TAP_OFFSETS;
  }

  setFocusDistance(distance) {
    this.material.uniforms.uFocusDistance.value = distance;
  }

  setSize(width, height) {
    this.material.uniforms.uAspect.value = width / Math.max(1, height);
  }

  render(renderer, writeBuffer, readBuffer) {
    const { uniforms } = this.material;

    uniforms.tDiffuse.value = readBuffer.texture;
    uniforms.tDepth.value = readBuffer.depthTexture;
    uniforms.uNear.value = this.camera.near;
    uniforms.uFar.value = this.camera.far;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}
