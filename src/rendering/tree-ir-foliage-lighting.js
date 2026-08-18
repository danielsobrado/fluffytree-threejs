const OPAQUE_FRAGMENT_MARKER = '#include <opaque_fragment>';
const FOLIAGE_LIGHTING_CACHE_KEY = 'tree-ir-foliage-lighting-v1';

export function injectTreeIrFoliageLighting(fragmentShader) {
  if (!fragmentShader.includes(OPAQUE_FRAGMENT_MARKER)) {
    throw new Error('Tree IR foliage lighting could not find opaque fragment marker.');
  }

  return fragmentShader.replace(
    OPAQUE_FRAGMENT_MARKER,
    `
      float treeFoliageFacing = abs(
        dot(normalize(normal), normalize(vViewPosition))
      );
      float treeFoliageRim = 1.0 - treeFoliageFacing;
      treeFoliageRim *= treeFoliageRim;
      float treeFoliageBackface = gl_FrontFacing ? 0.0 : 1.0;
      outgoingLight += diffuseColor.rgb * (
        uTreeFoliageSoftLight +
        treeFoliageRim * uTreeFoliageRimLight +
        treeFoliageBackface * uTreeFoliageBackLight
      );
      ${OPAQUE_FRAGMENT_MARKER}
    `,
  );
}

export function configureTreeIrFoliageLighting(
  material,
  { softLight = 0, rimLight = 0, backLight = 0 } = {},
) {
  const previousCompile = material.onBeforeCompile;
  const baseCacheKey = material.customProgramCacheKey();
  const lighting = Object.freeze({ softLight, rimLight, backLight });

  material.userData.foliageLighting = lighting;
  material.onBeforeCompile = (shader) => {
    previousCompile?.(shader);
    Object.assign(shader.uniforms, {
      uTreeFoliageSoftLight: { value: softLight },
      uTreeFoliageRimLight: { value: rimLight },
      uTreeFoliageBackLight: { value: backLight },
    });
    shader.fragmentShader = injectTreeIrFoliageLighting(shader.fragmentShader);
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () =>
    `${baseCacheKey}|${FOLIAGE_LIGHTING_CACHE_KEY}`;
  material.needsUpdate = true;
  return material;
}
