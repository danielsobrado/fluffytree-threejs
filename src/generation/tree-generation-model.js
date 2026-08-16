export const DEFAULT_TREE_GENERATION_MODEL = 'crown-lobe';

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
