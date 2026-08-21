import { TREE_WIND_PROFILE } from '../animation/tree-wind-profile.js?v=2.0.0-20260814.2';
import {
  createTreeWindState,
  installTreeWindUniforms,
} from './tree-wind-shader.js?v=2.0.0-20260814.2';

const PRIMARY_SCALE = TREE_WIND_PROFILE.primaryTimeScale.toFixed(4);
const SECONDARY_SCALE = TREE_WIND_PROFILE.secondaryTimeScale.toFixed(4);
const SECONDARY_PHASE_SCALE =
  TREE_WIND_PROFILE.secondaryPhaseScale.toFixed(4);

export function configureTreeIrFrondWindMaterial(material) {
  const windState = createTreeWindState();
  material.userData.windState = windState;
  material.onBeforeCompile = (shader) => {
    installTreeWindUniforms(shader, windState);
    shader.vertexShader = `
      uniform float uTreeWindTime;
      uniform float uTreeWindPhase;
      uniform float uTreeWindStrength;
      uniform float uTreeWindTreeHeight;
      attribute float treeFrondWindWeight;
      attribute float treeFrondWindPhase;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `
        #include <begin_vertex>
        float frondWindWeight = clamp(treeFrondWindWeight, 0.0, 1.0);
        float treePrimary =
          sin(uTreeWindTime * ${PRIMARY_SCALE} + uTreeWindPhase) -
          sin(uTreeWindPhase);
        float treeCrossPhase =
          uTreeWindPhase * ${SECONDARY_PHASE_SCALE};
        float treeCross =
          sin(uTreeWindTime * ${SECONDARY_SCALE} + treeCrossPhase) -
          sin(treeCrossPhase);
        float frondFlutterPhase =
          treeFrondWindPhase * 1.63 + frondWindWeight * 5.4;
        float frondFlutter =
          sin(uTreeWindTime * ${SECONDARY_SCALE} * 1.55 + frondFlutterPhase) -
          sin(frondFlutterPhase);
        transformed.x +=
          (treePrimary * 0.72 + frondFlutter * 0.12) *
          uTreeWindStrength * frondWindWeight;
        transformed.z +=
          (treeCross * 0.48 +
          frondFlutter * cos(treeFrondWindPhase) * 0.12) *
          uTreeWindStrength * frondWindWeight;
        transformed.y +=
          frondFlutter * uTreeWindStrength * frondWindWeight * 0.1;
      `,
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'tree-ir-frond-wind-v3';
  material.needsUpdate = true;
  return material;
}
