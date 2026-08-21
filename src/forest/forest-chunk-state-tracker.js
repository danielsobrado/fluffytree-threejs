import {
  FOREST_CHUNK_STATES,
  forestChunkStateRank,
} from './forest-chunk-state.js?v=2.0.0-20260814.2';

function createRecord() {
  return {
    currentState: FOREST_CHUNK_STATES.METADATA_ONLY,
    desiredState: FOREST_CHUNK_STATES.METADATA_ONLY,
    revision: 0,
  };
}

export class ForestChunkStateTracker {
  constructor() {
    this.records = new Map();
  }

  get(chunkKey) {
    return this.records.get(chunkKey) ?? null;
  }

  ensure(chunkKey) {
    if (!this.records.has(chunkKey)) this.records.set(chunkKey, createRecord());
    return this.records.get(chunkKey);
  }

  request(chunkKey, desiredState) {
    forestChunkStateRank(desiredState);
    const record = this.ensure(chunkKey);
    if (record.desiredState !== desiredState) {
      record.desiredState = desiredState;
      record.revision += 1;
    }
    return Object.freeze({
      chunkKey,
      revision: record.revision,
      currentState: record.currentState,
      desiredState: record.desiredState,
    });
  }

  isCurrent(token) {
    const record = this.records.get(token.chunkKey);
    return Boolean(record) && record.revision === token.revision;
  }

  complete(token, completedState = token.desiredState) {
    if (!this.isCurrent(token)) return false;
    forestChunkStateRank(completedState);
    const record = this.records.get(token.chunkKey);
    record.currentState = completedState;
    return true;
  }

  remove(chunkKey) {
    return this.records.delete(chunkKey);
  }

  clear() {
    this.records.clear();
  }

  get metrics() {
    const values = [...this.records.values()];
    return Object.freeze({
      chunkCount: values.length,
      pendingCount: values.filter(
        (record) => record.currentState !== record.desiredState,
      ).length,
    });
  }
}
