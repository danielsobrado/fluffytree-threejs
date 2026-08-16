export const DEFAULT_TREE_GENERATION_MODEL = 'crown-lobe';

/**
 * A generation model receives a validated preset, unsigned 32-bit seed and
 * generation options, and returns a valid serializable Tree IR. Generation
 * models do not create renderer objects or make runtime LOD decisions.
 */
export function resolveTreeGenerationModelId(
  value,
  path = 'generationModel',
) {
  if (value === undefined || value === null) {
    return DEFAULT_TREE_GENERATION_MODEL;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Configuration '${path}' must be a non-empty string.`);
  }

  return value.trim();
}
