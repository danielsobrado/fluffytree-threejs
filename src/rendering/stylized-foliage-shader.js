import {
  FOLIAGE_RENDERING_CONSTANTS,
} from './foliage-rendering-constants.js';
import {
  createTreeWindState,
  injectTreeWindVertexShader,
  installTreeWindUniforms,
} from './tree-wind-shader.js';

function srgbChannelToLinear(value) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function createLinearColor(value) {
  const match =
    typeof value === 'string'
      ? /^#?([0-9a-f]{6})$/i.exec(value.trim())
      : null;
  if (!match) return [1, 1, 1];

  const packed = Number.parseInt(match[1], 16);
  return [
    srgbChannelToLinear(((packed >> 16) & 0xff) / 255),
    srgbChannelToLinear(((packed >> 8) & 0xff) / 255),
    srgbChannelToLinear((packed & 0xff) / 255),
  ];
}

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
    varying vec3 vFoliageWorldPosition;
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
    varying vec3 vFoliageWorldPosition;
    uniform sampler2D uFoliagePalette;
    uniform vec3 uFoliageSunDirection;
    uniform float uFoliageWrapLight;
    uniform float uFoliageSkyLightStrength;
    uniform float uFoliageCavityStrength;
    uniform float uFoliageHeightLightStrength;
    uniform float uFoliageColorMultiplier;
    uniform float uFoliageSurfaceBreakup;
    uniform vec3 uFoliageUndersideTint;
    uniform float uFoliageUndersideStrength;
    uniform vec3 uFoliageSnowColor;
    uniform float uFoliageSnowStrength;
    uniform float uFoliageSnowSharpness;
    uniform float uFoliageRimStrength;
    uniform float uFoliageRimPower;
    uniform float uFoliageTranslucencyStrength;
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
  const rimExposureFloor =
    FOLIAGE_RENDERING_CONSTANTS.rimExposureFloor.toFixed(4);
  const rimSunFloor = FOLIAGE_RENDERING_CONSTANTS.rimSunFloor.toFixed(4);
  const translucencyExposureFloor =
    FOLIAGE_RENDERING_CONSTANTS.translucencyExposureFloor.toFixed(4);
  const translucencySurfaceFloor =
    FOLIAGE_RENDERING_CONSTANTS.translucencySurfaceFloor.toFixed(4);
  const translucencyRimFloor =
    FOLIAGE_RENDERING_CONSTANTS.translucencyRimFloor.toFixed(4);
  const translucencyTint = FOLIAGE_RENDERING_CONSTANTS.translucencyTint
    .map((value) => value.toFixed(4))
    .join(', ');

  return `
    vec3 foliagePaletteColor = texture2D(
      uFoliagePalette,
      vec2( clamp( vFoliagePaletteCoordinate + vFoliagePatch * 0.045, 0.0, 1.0 ), 0.5 )
    ).rgb;
    vec3 foliageRadial = normalize( vFoliageRadialWorld );
    vec3 foliageSunDirection = normalize( uFoliageSunDirection );
    float foliageSunAlignment = dot( foliageRadial, foliageSunDirection );
    float foliageWrappedLight = clamp(
      ( foliageSunAlignment + uFoliageWrapLight ) /
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
    float foliageDownward = clamp( -foliageRadial.y, 0.0, 1.0 );
    vec3 foliageShadowTint = mix(
      vec3( 1.0 ),
      uFoliageUndersideTint,
      foliageDownward * uFoliageUndersideStrength
    );
    diffuseColor.rgb = foliagePaletteColor * foliageSunFactor * foliageSkyFactor *
      foliageCavityFactor * foliageHeightFactor * foliageFineLight *
      foliageShadowTint * uFoliageColorMultiplier;

    float foliageTop = clamp( foliageRadial.y, 0.0, 1.0 );
    float foliageSnow = pow( foliageTop, uFoliageSnowSharpness ) *
      uFoliageSnowStrength;
    diffuseColor.rgb = mix(
      diffuseColor.rgb,
      uFoliageSnowColor * foliageSkyFactor,
      foliageSnow
    );

    vec3 foliageView = normalize( cameraPosition - vFoliageWorldPosition );
    float foliageRim = pow(
      clamp( 1.0 - abs( dot( foliageView, foliageRadial ) ), 0.0, 1.0 ),
      uFoliageRimPower
    );
    float foliageRimExposure = mix(
      ${rimExposureFloor},
      1.0,
      foliageExposure
    );
    float foliageRimSunWeight = mix(
      ${rimSunFloor},
      1.0,
      foliageWrappedLight
    );
    diffuseColor.rgb += foliagePaletteColor * foliageRim * foliageTop *
      foliageRimExposure * foliageRimSunWeight * uFoliageRimStrength;

    float foliageBacklight = pow(
      clamp( dot( foliageView, -foliageSunDirection ), 0.0, 1.0 ),
      3.0
    );
    float foliageSurfaceIrradiance = mix(
      ${translucencySurfaceFloor},
      1.0,
      abs( foliageSunAlignment )
    );
    float foliageTransmissionExposure = mix(
      ${translucencyExposureFloor},
      1.0,
      foliageExposure
    );
    float foliageTransmissionEdge = mix(
      ${translucencyRimFloor},
      1.0,
      foliageRim
    );
    float foliageTransmissionMask = foliageBacklight *
      foliageSurfaceIrradiance * foliageTransmissionExposure *
      foliageTransmissionEdge;
    diffuseColor.rgb += foliagePaletteColor * vec3( ${translucencyTint} ) *
      foliageTransmissionMask * uFoliageTranslucencyStrength;
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
      uFoliageUndersideTint: {
        value: createLinearColor(foliage.undersideTint),
      },
      uFoliageSnowColor: { value: createLinearColor(foliage.snowColor) },
      uFoliageSnowStrength: { value: Number(foliage.snowStrength ?? 0) },
      uFoliageSnowSharpness: {
        value: Math.max(0.1, Number(foliage.snowSharpness ?? 2)),
      },
      uFoliageUndersideStrength: {
        value: Number(foliage.undersideStrength ?? 0),
      },
      uFoliageRimStrength: { value: Number(foliage.rimStrength ?? 0) },
      uFoliageRimPower: { value: Math.max(0.1, Number(foliage.rimPower ?? 2.5)) },
      uFoliageTranslucencyStrength: {
        value: Number(foliage.translucencyStrength ?? 0),
      },
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
            vec4 foliageInstanceWorldPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
              foliageInstanceWorldPosition =
                instanceMatrix * foliageInstanceWorldPosition;
            #endif
            vFoliageWorldPosition =
              ( modelMatrix * foliageInstanceWorldPosition ).xyz;
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
