import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTreeReplacement } from '../src/app/tree-rebuild-transaction.js';

function createBatchManager(events) {
  return {
    clear() {
      events.push('clear-batches');
    },
  };
}

test('tree rebuild transaction stages every root before returning replacement state', () => {
  const events = [];
  const replacement = buildTreeReplacement(
    [{ preset: 'first' }, { preset: 'second' }],
    {
      createBatchManager: () => createBatchManager(events),
      buildEntry: (entry) => ({
        root: { id: entry.preset },
        treeData: { presetId: entry.preset },
      }),
      disposeRoot: () => events.push('dispose-root'),
    },
  );

  assert.deepEqual(replacement.roots.map((root) => root.id), ['first', 'second']);
  assert.equal(replacement.treeDataByPreset.get('second').presetId, 'second');
  assert.deepEqual(events, []);
});

test('tree rebuild transaction cleans staged resources when a later tree fails', () => {
  const events = [];

  assert.throws(
    () =>
      buildTreeReplacement(
        [{ preset: 'first' }, { preset: 'broken' }],
        {
          createBatchManager: () => createBatchManager(events),
          buildEntry: (entry) => {
            if (entry.preset === 'broken') throw new Error('generation failed');
            return {
              root: { id: entry.preset },
              treeData: { presetId: entry.preset },
            };
          },
          disposeRoot: (root) => events.push(`dispose-${root.id}`),
        },
      ),
    /generation failed/,
  );

  assert.deepEqual(events, ['clear-batches', 'dispose-first']);
});
