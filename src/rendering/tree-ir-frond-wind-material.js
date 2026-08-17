import { TREE_WIND_PROFILE } from '../animation/tree-wind-profile.js';
import {
  createTreeWindState,
  installTreeWindUniforms,
} from './tree-wind-shader.js';

const PRIMARY_SCALE = TREE_WIND_PROFILE.primaryTimeScale.toFixed(4);
const SECONDARY_SCALE = TREE_WIND_PROFILE.secondaryTimeScale.toFixed(4);

export function configureTreeIrFrondWindMaterial(material) {
  const windState = createTreeWindState();
  material.userData.windState = windState;
  material.onBeforeCompile = (shader) => {
    installTreeWindUniforms(shader, windState);
    shader.vertexShader = `
      attribute float treeFrondWindWeight;
      attribute float treeFrondWindPhase;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `
        #include <begin_vertex>
        float frondWindWeight = clamp(treeFrondWindWeight, 0.0, 1.0);
        float frondWindPhase = uTreeWindPhase + treeFrondWindPhase;
        float frondPrimary = sin(
          uTreeWindTime * ${PRIMARY_SCALE} + frondWindPhase
        );
        float frondSecondary = sin(
          uTreeWindTime * ${SECONDARY_SCALE} * 1.45 +
          frondWindPhase * 1.63 +
          frondWindWeight * 5.4
        );
        transformed.x +=
          (frondPrimary * 0.72 + frondSecondary * 0.16) *
          uTreeWindStrength * frondWindWeight;
        transformed.z +=
          (cos(uTreeWindTime * ${SECONDARY_SCALE} + frondWindPhase) * 0.52 +
          frondSecondary * 0.12) *
          uTreeWindStrength * frondWindWeight;
        transformed.y +=
          frondSecondary * uTreeWindStrength * frondWindWeight * 0.12;
      `,
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'tree-ir-frond-wind-v1';
  material.needsUpdate = true;
  return material;
}
