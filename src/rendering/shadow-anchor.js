/**
 * Where the sun should stand so its shadow map covers the viewer.
 *
 * One directional shadow map cannot cover a forest at a useful resolution, so
 * it covers the part of it somebody is standing in. Following the camera
 * continuously would re-render every caster every frame and swim the shadow
 * edges around as it went; snapping the anchor to a grid does neither, and the
 * step is what bounds how often the map is rebuilt.
 */
export function resolveShadowAnchor(current, focus, step) {
  const size = Math.max(0.001, step);
  const anchor = {
    x: Math.round(focus.x / size) * size,
    z: Math.round(focus.z / size) * size,
  };
  const moved = !current || current.x !== anchor.x || current.z !== anchor.z;

  return { anchor, moved };
}
