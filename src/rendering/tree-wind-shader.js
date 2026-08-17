import { TREE_WIND_PROFILE } from '../animation/tree-wind-profile.js';

function createVertexDeclarations() {
  return `
    uniform float uTreeWindTime;
    uniform float uTreeWindPhase;
    uniform float uTreeWindStrength;
    uniform float uTreeWindTreeHeight;
  `;
}

function createWindTransform() {
  const primaryTimeScale = TREE_WIND_PROFILE.primaryTimeScale.toFixed(4);
  const secondaryTimeScale = TREE_WIND_PROFILE.secondaryTimeScale.toFixed(4);
  const secondaryPhaseScale = TREE_WIND_PROFILE.secondaryPhaseScale.toFixed(4);
  const secondaryStrengthRatio =
    TREE_WIND_PROFILE.secondaryStrengthRatio.toFixed(4);
  const minimumTreeHeight = TREE_WIND_PROFILE.minimumTreeHeight.toExponential(1);
  const minimumScaleSquared =
    TREE_WIND_PROFILE.minimumInstanceScaleSquared.toExponential(1);

  return `
    float treeWindWeight = 1.0;
    #ifdef USE_INSTANCING
      treeWindWeight = clamp(
        instanceMatrix[ 3 ].y / max( uTreeWindTreeHeight, ${minimumTreeHeight} ),
        0.0,
        1.0
      );
    #endif
    float treeWindPrimary =
      sin(uTreeWindTime * ${primaryTimeScale} + uTreeWindPhase) -
      sin(uTreeWindPhase);
    float treeWindSecondaryPhase =
      uTreeWindPhase * ${secondaryPhaseScale};
    float treeWindSecondary =
      sin(uTreeWindTime * ${secondaryTimeScale} + treeWindSecondaryPhase) -
      sin(treeWindSecondaryPhase);
    vec3 treeWindObjectOffset = vec3(
      treeWindPrimary * uTreeWindStrength * treeWindWeight,
      0.0,
      treeWindSecondary * uTreeWindStrength * treeWindWeight *
        ${secondaryStrengthRatio}
    );
    #ifdef USE_INSTANCING
      mat3 treeWindInstanceBasis = mat3( instanceMatrix );
      vec3 treeWindBasisLengthSquared = vec3(
        dot( treeWindInstanceBasis[ 0 ], treeWindInstanceBasis[ 0 ] ),
        dot( treeWindInstanceBasis[ 1 ], treeWindInstanceBasis[ 1 ] ),
        dot( treeWindInstanceBasis[ 2 ], treeWindInstanceBasis[ 2 ] )
      );
      transformed += vec3(
        dot( treeWindInstanceBasis[ 0 ], treeWindObjectOffset ) /
          max( treeWindBasisLengthSquared.x, ${minimumScaleSquared} ),
        dot( treeWindInstanceBasis[ 1 ], treeWindObjectOffset ) /
          max( treeWindBasisLengthSquared.y, ${minimumScaleSquared} ),
        dot( treeWindInstanceBasis[ 2 ], treeWindObjectOffset ) /
          max( treeWindBasisLengthSquared.z, ${minimumScaleSquared} )
      );
    #else
      transformed += treeWindObjectOffset;
    #endif
  `;
}

export function createTreeWindState() {
  return {
    time: 0,
    phase: 0,
    strength: TREE_WIND_PROFILE.shaderFallbackStrength,
    treeHeight: 1,
  };
}

export function installTreeWindUniforms(shader, windState) {
  Object.assign(shader.uniforms, {
    uTreeWindTime: {
      get value() {
        return windState.time;
      },
    },
    uTreeWindPhase: {
      get value() {
        return windState.phase;
      },
    },
    uTreeWindStrength: {
      get value() {
        return windState.strength;
      },
    },
    uTreeWindTreeHeight: {
      get value() {
        return windState.treeHeight;
      },
    },
  });
}

export function injectTreeWindVertexShader(vertexShader) {
  return `${createVertexDeclarations()}\n${vertexShader}`.replace(
    '#include <begin_vertex>',
    `
      #include <begin_vertex>
      ${createWindTransform()}
    `,
  );
}

export function configureTreeWindMaterial(
  material,
  { cacheKey = 'tree-wind-v2' } = {},
) {
  const windState = createTreeWindState();
  material.userData.windState = windState;
  material.onBeforeCompile = (shader) => {
    installTreeWindUniforms(shader, windState);
    shader.vertexShader = injectTreeWindVertexShader(shader.vertexShader);
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => cacheKey;
  material.needsUpdate = true;
  return material;
}
