/**
 * The soft pool of shade a crown pushes onto the ground beneath it.
 *
 * This is not the sun's shadow — the shadow map already draws that, from
 * wherever the sun happens to stand. This is the ambient darkening under a
 * canopy: the sky is occluded there whatever the sun is doing, which is why in
 * the reference frames every tree and wall sits in a pool that does not move
 * with the light. Without it a tree reads as hovering over the meadow, because
 * a soft directional shadow alone never quite touches the trunk.
 *
 * So the pool is centred under the crown rather than offset along the sun, and
 * it is sized from the crown's own footprint: a leaning bonsai's shade belongs
 * under the canopy it actually has, not under its trunk.
 */

export const DEFAULT_CONTACT_SHADOW = Object.freeze({
  enabled: true,
  /** The pool spreads a little past the crown, the way a soft one does. */
  radiusScale: 1.12,
  /** How dark the centre of the pool gets, from 0 to 1. */
  strength: 0.42,
  /** Height above the ground plane; enough to clear it, not enough to see. */
  height: 0.02,
  minimumRadius: 0.3,
});

export function resolveContactShadowSettings(config = {}) {
  const settings = { ...DEFAULT_CONTACT_SHADOW };

  for (const key of ['radiusScale', 'strength', 'height', 'minimumRadius']) {
    const value = config[key];
    if (typeof value === 'number' && Number.isFinite(value)) settings[key] = value;
  }
  settings.enabled = config.enabled !== false;
  settings.strength = Math.min(Math.max(settings.strength, 0), 1);
  settings.radiusScale = Math.max(settings.radiusScale, 0);
  settings.minimumRadius = Math.max(settings.minimumRadius, 0);

  return settings;
}

/**
 * Where one tree's pool goes and how wide it is.
 *
 * The bounds are the tree's own, in its own space, so a rotated layout entry
 * has to rotate the crown's offset with it — otherwise a leaning tree that has
 * been turned to face the camera drags its shade round to the wrong side.
 */
export function resolveContactShadowFootprint(
  { bounds, position, rotationY = 0, scale = 1 },
  settings = DEFAULT_CONTACT_SHADOW,
) {
  const centreX = (bounds.minimum.x + bounds.maximum.x) * 0.5;
  const centreZ = (bounds.minimum.z + bounds.maximum.z) * 0.5;
  const extentX = (bounds.maximum.x - bounds.minimum.x) * 0.5;
  const extentZ = (bounds.maximum.z - bounds.minimum.z) * 0.5;

  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const rotatedX = centreX * cos + centreZ * sin;
  const rotatedZ = -centreX * sin + centreZ * cos;

  return {
    x: position[0] + rotatedX * scale,
    z: position[2] + rotatedZ * scale,
    radius: Math.max(
      Math.max(extentX, extentZ) * scale * settings.radiusScale,
      settings.minimumRadius,
    ),
  };
}
