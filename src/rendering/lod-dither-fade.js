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

const LOD_FADE_STATES_KEY = 'lodFadeStates';

function visitMaterials(root, visitor) {
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) visitor(material);
  });
}

function collectLodFadeStates(root) {
  const states = [];
  const seen = new Set();

  visitMaterials(root, (material) => {
    const state = material.userData.lodFade;
    if (!state || seen.has(state)) return;
    seen.add(state);
    states.push(state);
  });
  root.userData ??= {};
  root.userData[LOD_FADE_STATES_KEY] = states;
  return states;
}

function getLodFadeStates(root) {
  return root.userData?.[LOD_FADE_STATES_KEY] ?? collectLodFadeStates(root);
}

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
  visitMaterials(root, configureLodDitherFade);
  collectLodFadeStates(root);
  return root;
}

export function snapshotObjectLodFade(root) {
  const states = getLodFadeStates(root).map((state) => ({
    state,
    value: state.value,
    invert: state.invert,
  }));

  return {
    visible: root.visible,
    states,
  };
}

export function restoreObjectLodFade(root, snapshot) {
  root.visible = snapshot.visible;
  for (const entry of snapshot.states) {
    entry.state.value = entry.value;
    entry.state.invert = entry.invert;
  }
}

export function setObjectLodFade(root, value, invert = false) {
  const fade = Math.min(1, Math.max(0, value));
  root.visible = fade > 0.001;
  const inverted = invert ? 1 : 0;
  for (const state of getLodFadeStates(root)) {
    state.value = fade;
    state.invert = inverted;
  }
}
