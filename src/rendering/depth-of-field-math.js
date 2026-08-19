/**
 * How much of the frame is out of focus, and by how far.
 *
 * The diorama read in the reference frames is carried by the lens more than by
 * the canopy: one narrow band of the scene is sharp and everything in front of
 * and behind it melts. That is a depth-of-field effect, so the amount of blur a
 * pixel gets is a function of how far its surface is from the focal plane, not
 * of where it sits on screen. A screen-space band would look right from the
 * garden's fixed camera and wrong the moment somebody walks through the forest.
 *
 * Near and far get their own falloff. A real lens blurs the foreground faster
 * than the background, and the reference exaggerates it: the grass in front of
 * the church is gone within a metre or two while the tree line stays legible
 * for a long way back.
 *
 * Kept apart from the pipeline so the focus solve and the blur ramp can be
 * tested without a renderer; the shader repeats `circleOfConfusion` in GLSL
 * because it evaluates it per tap.
 */

export const DEFAULT_DEPTH_OF_FIELD = Object.freeze({
  enabled: true,
  /** Half-width, in world units, of the fully sharp band around the focus. */
  focusRange: 4.5,
  /** World distance over which the near field ramps to maximum blur. */
  nearFalloff: 5,
  /** The far field ramps more slowly, so the tree line stays readable. */
  farFalloff: 26,
  /** Blur radius at full circle of confusion, as a fraction of frame height. */
  blurRadius: 0.011,
  /** The focus never collapses onto the lens or runs past the fog. */
  minimumFocus: 6,
  maximumFocus: 44,
  /** Where a walking viewer's eye is assumed to rest, in metres ahead. */
  walkFocus: 15,
});

function readNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The configured settings, with every field defaulted to the tuned values. */
export function resolveDepthOfFieldSettings(config = {}) {
  const settings = { ...DEFAULT_DEPTH_OF_FIELD };

  for (const key of Object.keys(DEFAULT_DEPTH_OF_FIELD)) {
    if (key === 'enabled') continue;
    settings[key] = readNumber(config[key], DEFAULT_DEPTH_OF_FIELD[key]);
  }
  settings.enabled = config.enabled !== false;

  // A falloff of zero would make the ramp a step, and a division by it a
  // division by zero in the shader.
  settings.nearFalloff = Math.max(settings.nearFalloff, 0.001);
  settings.farFalloff = Math.max(settings.farFalloff, 0.001);
  settings.focusRange = Math.max(settings.focusRange, 0);
  settings.blurRadius = Math.max(settings.blurRadius, 0);
  settings.maximumFocus = Math.max(settings.maximumFocus, settings.minimumFocus);

  return settings;
}

/**
 * Where the lens should focus this frame.
 *
 * Orbiting, that is whatever the camera is orbiting: the subject is by
 * definition the thing being looked at. Walking, there is no such point, so the
 * focus rests a fixed distance ahead and the clamp keeps a viewer who has
 * pressed themselves against a trunk from throwing the whole frame out.
 */
export function resolveFocusDistance({ cameraPosition, target, walking }, settings) {
  if (walking) {
    return clampFocus(settings.walkFocus, settings);
  }

  const dx = cameraPosition.x - target.x;
  const dy = cameraPosition.y - target.y;
  const dz = cameraPosition.z - target.z;

  return clampFocus(Math.sqrt(dx * dx + dy * dy + dz * dz), settings);
}

function clampFocus(distance, settings) {
  return Math.min(
    Math.max(distance, settings.minimumFocus),
    settings.maximumFocus,
  );
}

/**
 * How out of focus a surface at this distance is, from 0 (sharp) to 1.
 *
 * Distances behind the camera cannot be seen, so a negative one is treated as
 * being on the lens and fully blurred rather than wrapping back into focus.
 */
export function circleOfConfusion(distance, focusDistance, settings) {
  const gap = distance - focusDistance;
  const falloff = gap < 0 ? settings.nearFalloff : settings.farFalloff;
  const beyondSharp = Math.max(Math.abs(gap) - settings.focusRange, 0);

  return Math.min(beyondSharp / falloff, 1);
}
