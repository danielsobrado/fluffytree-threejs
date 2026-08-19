/**
 * Whether the build-time QA analyzers run.
 *
 * The manifold and LOD budget analyzers exist to prove properties of a build,
 * not to produce one. Manifold analysis walks every edge of the trunk and runs
 * once per structure mesh, which is four times per tree; the LOD budget
 * analyzer walks every level of every tree. Nothing a player sees reads either
 * result, so a scene that is not being measured should not pay for them.
 *
 * A page carrying a `qa` query parameter is a QA page and opts itself in. Node
 * runners have no location to read, so they call the setter.
 */

function detectAnalysisMode() {
  if (typeof window === 'undefined' || !window.location) return false;
  return new URLSearchParams(window.location.search).has('qa');
}

let analysisEnabled = detectAnalysisMode();

export function isAnalysisEnabled() {
  return analysisEnabled;
}

export function setAnalysisEnabled(value) {
  analysisEnabled = value === true;
}
