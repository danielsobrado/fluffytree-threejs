export const FOREST_CHUNK_STATES = Object.freeze({
  UNLOADED: 'unloaded',
  METADATA_ONLY: 'metadata-only',
  IMPOSTOR_READY: 'impostor-ready',
  AGGREGATE_READY: 'aggregate-ready',
  NEAR_READY: 'near-ready',
  HERO_READY: 'hero-ready',
});

export const FOREST_CHUNK_STATE_ORDER = Object.freeze([
  FOREST_CHUNK_STATES.UNLOADED,
  FOREST_CHUNK_STATES.METADATA_ONLY,
  FOREST_CHUNK_STATES.IMPOSTOR_READY,
  FOREST_CHUNK_STATES.AGGREGATE_READY,
  FOREST_CHUNK_STATES.NEAR_READY,
  FOREST_CHUNK_STATES.HERO_READY,
]);

export function forestChunkStateRank(state) {
  const rank = FOREST_CHUNK_STATE_ORDER.indexOf(state);
  if (rank < 0) throw new Error(`Unknown forest chunk state '${state}'.`);
  return rank;
}
