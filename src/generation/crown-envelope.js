import { GENERATION_CONSTANTS } from './generation-constants.js';

// The pad profile is widest a short way above its base. Scaling by the fall-off
// at that height keeps `crown.radius` meaning the widest point, as it does for
// every other profile.
const PAD_SHOULDER = 0.18;
const PAD_NORMALIZATION = 1 / Math.pow(1 - PAD_SHOULDER, 0.38);

export const CROWN_ENVELOPE_CONSTANTS = Object.freeze({
  asymmetryX: 0.42,
  asymmetryZ: 0.18,
});

const PROFILE_FUNCTIONS = Object.freeze({
  round(t) {
    const centered = t * 2 - 1;
    return Math.sqrt(Math.max(0, 1 - centered * centered));
  },
  columnar(t) {
    return Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.28);
  },
  vase(t) {
    const cap = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.34);
    const widening = 0.48 + 0.62 * Math.pow(t, 0.72);
    return cap * widening;
  },
  // Layered bonsai foliage pads: a broad, almost flat underside just above the
  // first branch and a long taper to a small apex.
  pad(t) {
    const rise = Math.pow(Math.min(1, t / PAD_SHOULDER), 0.7);
    const fall = Math.pow(Math.max(0, 1 - t), 0.38);
    return rise * fall * PAD_NORMALIZATION;
  },
});

const NO_ANCHOR = Object.freeze({ x: 0, z: 0 });

export const CROWN_PROFILE_IDS = Object.freeze(Object.keys(PROFILE_FUNCTIONS));

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function calculateCrownEnvelopeBounds(envelope, radiusMargin = 1) {
  if (!Number.isFinite(radiusMargin) || radiusMargin < 1) {
    throw new RangeError('Crown envelope radius margin must be at least 1.');
  }

  const { crown, anchor } = envelope;
  const radialExtent = crown.radius * radiusMargin;
  const xMinimumCenter =
    anchor.x +
    Math.min(0, crown.lean[0]) -
    crown.asymmetry * CROWN_ENVELOPE_CONSTANTS.asymmetryX;
  const xMaximumCenter =
    anchor.x +
    Math.max(0, crown.lean[0]) +
    crown.asymmetry * CROWN_ENVELOPE_CONSTANTS.asymmetryX;
  const zMinimumCenter =
    anchor.z +
    Math.min(0, crown.lean[1]) -
    crown.asymmetry * CROWN_ENVELOPE_CONSTANTS.asymmetryZ;
  const zMaximumCenter =
    anchor.z +
    Math.max(0, crown.lean[1]) +
    crown.asymmetry * CROWN_ENVELOPE_CONSTANTS.asymmetryZ;

  return {
    minimum: {
      x: xMinimumCenter - radialExtent,
      y: crown.baseHeight,
      z: zMinimumCenter - radialExtent,
    },
    maximum: {
      x: xMaximumCenter + radialExtent,
      y: crown.baseHeight + crown.height,
      z: zMaximumCenter + radialExtent,
    },
  };
}

export class CrownEnvelope {
  constructor(crown) {
    const profile = PROFILE_FUNCTIONS[crown.profile];

    if (!profile) {
      throw new Error(`Unsupported crown profile '${crown.profile}'.`);
    }

    this.crown = crown;
    this.profile = profile;
    // Where the trunk style parks its apex. Styles that lean or sweep carry the
    // whole canopy with them, so the crown still sits on top of the trunk.
    this.anchor = crown.anchor ?? NO_ANCHOR;
  }

  static supportsProfile(profile) {
    return Object.hasOwn(PROFILE_FUNCTIONS, profile);
  }

  radiusAt(normalizedHeight) {
    const t = clamp01(normalizedHeight);
    const profileRadius = Math.max(
      GENERATION_CONSTANTS.minimumProfileRadius,
      this.profile(t),
    );

    return this.crown.radius * profileRadius;
  }

  centerAt(normalizedHeight) {
    const t = clamp01(normalizedHeight);
    const bend = Math.sin(t * Math.PI * 0.82);

    return {
      x:
        this.crown.lean[0] * t +
        this.crown.asymmetry * bend * CROWN_ENVELOPE_CONSTANTS.asymmetryX +
        this.anchor.x,
      y: this.crown.baseHeight + this.crown.height * t,
      z:
        this.crown.lean[1] * t -
        this.crown.asymmetry * bend * CROWN_ENVELOPE_CONSTANTS.asymmetryZ +
        this.anchor.z,
    };
  }

  contains(point) {
    const t = (point.y - this.crown.baseHeight) / this.crown.height;

    if (t < 0 || t > 1) {
      return false;
    }

    const center = this.centerAt(t);
    const radius = this.radiusAt(t);
    const dx = point.x - center.x;
    const dz = point.z - center.z;

    return dx * dx + dz * dz <= radius * radius;
  }
}
