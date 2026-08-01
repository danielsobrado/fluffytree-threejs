import {
  FOLIAGE_RENDERING_CONSTANTS,
} from './foliage-rendering-constants.js';

function createVertexDeclarations() {
  return `
    attribute float instanceColorMix;
    attribute float instanceExposure;
    varying float vFoliagePaletteCoordinate;
    varying float vFoliageExposure;
    varying float vFoliageHeight;
    varying vec3 vFoliageRadialWorld;
    uniform float uFoliageVariation;
    uniform float uFoliagePaletteBase;
    uniform float uFoliageHeightPaletteShift;
    uniform float uFoliageExposurePaletteShift;
    uniform float uFoliageRadialNormalStrength;
  `;
}

function createFragmentDeclarations() {
  return `
    varying float vFoliagePaletteCoordinate;
    varying float vFoliageExposure;
    varying float vFoliageHeight;
    varying vec3 vFoliageRadialWorld;
    uniform sampler2D uFoliagePalette;
    uniform vec3 uFoliageSunDirection;
    uniform float uFoliageWrapLight;
    uniform float uFoliageSkyLightStrength;
    uniform float uFoliageCavityStrength;
    uniform float uFoliageHeightLightStrength;
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
    vFoliageRadialWorld = normalize( mat3( modelMatrix ) * foliageRadialInstance );
  `;
}

function createColorShader() {
  const minimumSun = FOLIAGE_RENDERING_CONSTANTS.minimumSunFactor.toFixed(4);
  const maximumSun = FOLIAGE_RENDERING_CONSTANTS.maximumSunFactor.toFixed(4);
  const skyHighlight = FOLIAGE_RENDERING_CONSTANTS.skyHighlightRatio.toFixed(4);

  return `
    vec3 foliagePaletteColor = texture2D(
      uFoliagePalette,
      vec2( clamp( vFoliagePaletteCoordinate, 0.0, 1.0 ), 0.5 )
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
    float foliageCavityFactor = mix(
      1.0 - uFoliageCavityStrength,
      1.0,
      clamp( vFoliageExposure, 0.0, 1.0 )
    );
    float foliageHeightFactor = mix(
      1.0 - uFoliageHeightLightStrength,
      1.0 + uFoliageHeightLightStrength,
      clamp( vFoliageHeight, 0.0, 1.0 )
    );
    diffuseColor.rgb = foliagePaletteColor * foliageSunFactor * foliageSkyFactor *
      foliageCavityFactor * foliageHeightFactor;
  `;
}

export function configureStylizedFoliageShader(
  material,
  {
    foliage,
    paletteTexture,
    sunDirection,
    radialNormalExpression,
    heightExpression,
    cacheKey,
  },
) {
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
      uFoliageWrapLight: { value: foliage.wrapLight },
      uFoliageSkyLightStrength: { value: foliage.skyLightStrength },
      uFoliageCavityStrength: { value: foliage.cavityStrength },
      uFoliageHeightLightStrength: { value: foliage.heightLightStrength },
    });

    shader.vertexShader = `${createVertexDeclarations()}\n${shader.vertexShader}`
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
          vFoliageExposure = instanceExposure;
          vFoliagePaletteCoordinate = clamp(
            uFoliagePaletteBase +
              ( instanceColorMix - 0.5 ) * uFoliageVariation +
              ( vFoliageHeight - 0.5 ) * uFoliageHeightPaletteShift +
              ( instanceExposure - 0.5 ) * uFoliageExposurePaletteShift,
            0.0,
            1.0
          );
        `,
      )
      .replace(
        '#include <project_vertex>',
        `
          #include <project_vertex>
          ${createWorldRadialShader()}
        `,
      );

    shader.fragmentShader = `${createFragmentDeclarations()}\n${shader.fragmentShader}`
      .replace(
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
