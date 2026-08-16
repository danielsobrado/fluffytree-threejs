import {
  FOLIAGE_RENDERING_CONSTANTS,
} from './foliage-rendering-constants.js';
import {
  createTreeWindState,
  injectTreeWindVertexShader,
  installTreeWindUniforms,
} from './tree-wind-shader.js';

function createVertexDeclarations() {
  return `
    attribute float instanceColorMix;
    attribute float instanceExposure;
    attribute vec3 instanceCrownDirection;
    varying float vFoliagePaletteCoordinate;
    varying float vFoliageExposure;
    varying float vFoliageHeight;
    varying vec3 vFoliageRadialWorld;
    varying float vFoliagePatch;
    varying float vFoliageStylePhase;
    varying vec3 vFoliageLocalPosition;
    uniform float uFoliageVariation;
    uniform float uFoliagePaletteBase;
    uniform float uFoliageHeightPaletteShift;
    uniform float uFoliageExposurePaletteShift;
    uniform float uFoliageRadialNormalStrength;
    uniform float uFoliageCrownNormalBlend;
  `;
}

function createFragmentDeclarations() {
  return `
    varying float vFoliagePaletteCoordinate;
    varying float vFoliageExposure;
    varying float vFoliageHeight;
    varying vec3 vFoliageRadialWorld;
    varying float vFoliagePatch;
    varying float vFoliageStylePhase;
    varying vec3 vFoliageLocalPosition;
    uniform sampler2D uFoliagePalette;
    uniform vec3 uFoliageSunDirection;
    uniform float uFoliageWrapLight;
    uniform float uFoliageSkyLightStrength;
    uniform float uFoliageCavityStrength;
    uniform float uFoliageHeightLightStrength;
    uniform float uFoliageColorMultiplier;
    uniform float uFoliageSurfaceBreakup;
  `;
}

function createWorldRadialShader() {
  return `
    vec3 foliageRadialInstance = foliageRadialLocal;
    #ifdef USE_INSTANCING
      mat3 foliageInstanceMatrix = mat3( instanceMatrix );
      foliageRadialInstance /= vec3(
        dot( foliageInstanceMatrix[ 0 ], foliageInstanceMatrix[ 0 ] ),
        dot( foliageInstanceMatrix[ 1 ], foliageInstanceMatrix[ 1 ] ),
        dot( foliageInstanceMatrix[ 2 ], foliageInstanceMatrix[ 2 ] )
      );
      foliageRadialInstance = foliageInstanceMatrix * foliageRadialInstance;
    #endif
    vec3 foliageLobeRadialWorld = normalize(
      mat3( modelMatrix ) * foliageRadialInstance
    );
    vec3 foliageCrownRadialWorld = normalize(
      mat3( modelMatrix ) * instanceCrownDirection
    );
    vFoliageRadialWorld = normalize( mix(
      foliageLobeRadialWorld,
      foliageCrownRadialWorld,
      uFoliageCrownNormalBlend
    ) );
  `;
}

function createColorShader() {
  const minimumSun = FOLIAGE_RENDERING_CONSTANTS.minimumSunFactor.toFixed(4);
  const maximumSun = FOLIAGE_RENDERING_CONSTANTS.maximumSunFactor.toFixed(4);
  const skyHighlight = FOLIAGE_RENDERING_CONSTANTS.skyHighlightRatio.toFixed(4);

  return `
    vec3 foliagePaletteColor = texture2D(
      uFoliagePalette,
      vec2( clamp( vFoliagePaletteCoordinate + vFoliagePatch * 0.045, 0.0, 1.0 ), 0.5 )
    ).rgb;
    vec3 foliageRadial = normalize( vFoliageRadialWorld );
    float foliageWrappedLight = clamp(
      ( dot( foliageRadial, normalize( uFoliageSunDirection ) ) + uFoliageWrapLight ) /
        ( 1.0 + uFoliageWrapLight ),
      0.0,
      1.0
    );
    float foliageSunFactor = mix( ${minimumSun}, ${maximumSun}, foliageWrappedLight );
    float foliageSkyAlignment = clamp( foliageRadial.y * 0.5 + 0.5, 0.0, 1.0 );
    float foliageSkyFactor = mix(
      1.0 - uFoliageSkyLightStrength,
      1.0 + uFoliageSkyLightStrength * ${skyHighlight},
      foliageSkyAlignment
    );
    float foliageExposure = smoothstep(
      0.08,
      0.92,
      clamp( vFoliageExposure, 0.0, 1.0 )
    );
    float foliageCavityFactor = mix(
      1.0 - uFoliageCavityStrength,
      1.0,
      foliageExposure
    );
    float foliageHeightFactor = mix(
      1.0 - uFoliageHeightLightStrength,
      1.0 + uFoliageHeightLightStrength,
      clamp( vFoliageHeight, 0.0, 1.0 )
    );
    float foliageFinePattern =
      sin(
        vFoliageLocalPosition.x * 8.5 +
        vFoliageLocalPosition.y * 6.1 +
        vFoliageStylePhase * 1.7
      ) *
      sin(
        vFoliageLocalPosition.z * 9.2 -
        vFoliageLocalPosition.y * 6.7 -
        vFoliageStylePhase * 1.3
      );
    float foliageFineLight = mix(
      1.0,
      mix(0.84, 1.08, smoothstep(-0.5, 0.5, foliageFinePattern)),
      uFoliageSurfaceBreakup
    );
    diffuseColor.rgb = foliagePaletteColor * foliageSunFactor * foliageSkyFactor *
      foliageCavityFactor * foliageHeightFactor * foliageFineLight *
      uFoliageColorMultiplier;
  `;
}

function applyFragmentNormalOverride(fragmentShader, forceRadialFragmentNormal) {
  if (!forceRadialFragmentNormal) return fragmentShader;

  return fragmentShader.replace(
    '#include <normal_fragment_begin>',
    `
      #include <normal_fragment_begin>
      normal = normalize( mat3( viewMatrix ) * vFoliageRadialWorld );
    `,
  );
}

export function configureStylizedFoliageShader(
  material,
  {
    foliage,
    paletteTexture,
    sunDirection,
    radialNormalExpression,
    heightExpression,
    forceRadialFragmentNormal = false,
    colorMultiplier = 1,
    surfaceBreakup = 0.035,
    cacheKey,
  },
) {
  const windState = createTreeWindState();
  material.userData.windState = windState;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uFoliagePalette: { value: paletteTexture },
      uFoliageSunDirection: { value: sunDirection.clone().normalize() },
      uFoliageVariation: { value: foliage.variation },
      uFoliagePaletteBase: { value: foliage.paletteBase },
      uFoliageHeightPaletteShift: { value: foliage.heightPaletteShift },
      uFoliageExposurePaletteShift: {
        value: foliage.exposurePaletteShift,
      },
      uFoliageRadialNormalStrength: {
        value: foliage.radialNormalStrength,
      },
      uFoliageCrownNormalBlend: {
        value: foliage.crownNormalBlend,
      },
      uFoliageWrapLight: { value: foliage.wrapLight },
      uFoliageSkyLightStrength: { value: foliage.skyLightStrength },
      uFoliageCavityStrength: { value: foliage.cavityStrength },
      uFoliageHeightLightStrength: { value: foliage.heightLightStrength },
      uFoliageColorMultiplier: { value: colorMultiplier },
      uFoliageSurfaceBreakup: { value: surfaceBreakup },
    });
    installTreeWindUniforms(shader, windState);

    shader.vertexShader = injectTreeWindVertexShader(
      `${createVertexDeclarations()}\n${shader.vertexShader}`
        .replace(
          '#include <beginnormal_vertex>',
          `
            #include <beginnormal_vertex>
            vec3 foliageRadialLocal = ${radialNormalExpression};
            objectNormal = normalize( mix(
              objectNormal,
              foliageRadialLocal,
              uFoliageRadialNormalStrength
            ) );
          `,
        )
        .replace(
          '#include <begin_vertex>',
          `
            #include <begin_vertex>
            vFoliageHeight = clamp( ${heightExpression}, 0.0, 1.0 );
            vFoliageLocalPosition = position;
            vFoliageStylePhase =
              dot(
                normalize( instanceCrownDirection + vec3( 0.0001 ) ),
                vec3( 1.31, 2.17, 2.83 )
              ) * 6.2831853 +
              instanceColorMix * 3.17;
            vFoliageExposure = instanceExposure;
            vFoliagePaletteCoordinate = clamp(
              uFoliagePaletteBase +
                ( instanceColorMix - 0.5 ) * uFoliageVariation +
                ( vFoliageHeight - 0.5 ) * uFoliageHeightPaletteShift +
                ( instanceExposure - 0.5 ) * uFoliageExposurePaletteShift,
              0.0,
              1.0
            );
            vFoliagePatch =
              sin(
                position.x * 4.1 +
                position.y * 3.2 +
                vFoliageStylePhase
              ) * 0.62 +
              sin(
                position.z * 4.7 -
                position.y * 3.6 -
                vFoliageStylePhase * 1.37
              ) * 0.38;
          `,
        )
        .replace(
          '#include <project_vertex>',
          `
            #include <project_vertex>
            ${createWorldRadialShader()}
          `,
        ),
    );

    shader.fragmentShader = applyFragmentNormalOverride(
      `${createFragmentDeclarations()}\n${shader.fragmentShader}`,
      forceRadialFragmentNormal,
    ).replace(
      '#include <color_fragment>',
      `
        #include <color_fragment>
        ${createColorShader()}
      `,
    );

    material.userData.shader = shader;
  };

  material.customProgramCacheKey = () => cacheKey;
  material.userData.disposables = [paletteTexture];
  material.needsUpdate = true;
  return material;
}
