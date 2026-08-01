const DITHER_SHADER = `
  float treeLodNoise = fract(
    52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))
  );
  if (uTreeLodInvert < 0.5) {
    if (treeLodNoise > uTreeLodFade) discard;
  } else if (treeLodNoise < 1.0 - uTreeLodFade) {
    discard;
  }
`;

export function configureLodDitherFade(material) {
  if (material.userData.lodFade) return material;
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey?.bind(material);
  const state = { value: 1, invert: 0 };

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.(shader, renderer);
    shader.uniforms.uTreeLodFade = state;
    shader.uniforms.uTreeLodInvert = {
      get value() {
        return state.invert;
      },
    };
    shader.fragmentShader = `uniform float uTreeLodFade;\nuniform float uTreeLodInvert;\n${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      `${DITHER_SHADER}\n#include <dithering_fragment>`,
    );
  };
  material.customProgramCacheKey = () =>
    `${previousCacheKey?.() ?? material.type}-tree-lod-dither-v1`;
  material.userData.lodFade = state;
  material.needsUpdate = true;
  return material;
}

export function configureObjectLodFade(root) {
  root.traverse((object) => {
    if (!object.material) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach(configureLodDitherFade);
  });
  return root;
}

export function setObjectLodFade(root, value, invert = false) {
  const fade = Math.min(1, Math.max(0, value));
  root.visible = fade > 0.001;
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) {
      if (material.userData.lodFade) {
        material.userData.lodFade.value = fade;
        material.userData.lodFade.invert = invert ? 1 : 0;
      }
    }
  });
}
