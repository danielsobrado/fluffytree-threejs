import { TREE_RENDER_REPRESENTATION_ROLES } from '../rendering/tree-representation-role.js';

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value;
}

function requireInteger(value, minimum, path) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${path} must be an integer >= ${minimum}.`);
  }
  return value;
}

function requireDensity(value, path) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${path} must be within [0, 1].`);
  }
  return value;
}

function parseMaximumStemOrder(value, path) {
  if (value === null) return null;
  return requireInteger(value, 0, path);
}

function parseRepresentation(source, path) {
  requireObject(source, path);
  return Object.freeze({
    maximumStemOrder: parseMaximumStemOrder(
      source.maximumStemOrder,
      `${path}.maximumStemOrder`,
    ),
    foliageDensity: requireDensity(
      source.foliageDensity,
      `${path}.foliageDensity`,
    ),
    crownVolumeDensity: requireDensity(
      source.crownVolumeDensity,
      `${path}.crownVolumeDensity`,
    ),
  });
}

export function parseTreeQualityProfiles(config) {
  const profiles = requireObject(config?.profiles, 'treeQualityProfiles.profiles');
  const parsed = {};

  for (const [profileId, profile] of Object.entries(profiles)) {
    const path = `treeQualityProfiles.profiles.${profileId}`;
    requireObject(profile, path);
    const representations = requireObject(
      profile.representations,
      `${path}.representations`,
    );
    const parsedRepresentations = {};
    for (const role of TREE_RENDER_REPRESENTATION_ROLES) {
      if (representations[role] === undefined) {
        throw new Error(`Missing required configuration '${path}.representations.${role}'.`);
      }
      parsedRepresentations[role] = parseRepresentation(
        representations[role],
        `${path}.representations.${role}`,
      );
    }
    const cache = requireObject(profile.cache, `${path}.cache`);
    parsed[profileId] = Object.freeze({
      id: profileId,
      representations: Object.freeze(parsedRepresentations),
      cache: Object.freeze({
        treeIrMaximumEntries: requireInteger(
          cache.treeIrMaximumEntries,
          1,
          `${path}.cache.treeIrMaximumEntries`,
        ),
        representationMaximumEntries: requireInteger(
          cache.representationMaximumEntries,
          1,
          `${path}.cache.representationMaximumEntries`,
        ),
      }),
    });
  }

  if (Object.keys(parsed).length === 0) {
    throw new Error('Tree quality profiles must not be empty.');
  }
  return Object.freeze(parsed);
}
