import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTreeShowcaseLayout } from '../src/config/tree-showcase-layout-config.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const layoutConfig = readYamlConfigSync(
  new URL('../config/universal-showcase-layout.yaml', import.meta.url),
);
const palmConfig = readYamlConfigSync(
  new URL('../config/palm-presets.yaml', import.meta.url),
);
const broadleafConfig = readYamlConfigSync(
  new URL('../config/advanced-broadleaf-presets.yaml', import.meta.url),
);

test('universal showcase layout is valid and references native species', () => {
  const layout = parseTreeShowcaseLayout(layoutConfig);
  const library = PresetLibrary.fromConfigs([palmConfig, broadleafConfig]);

  assert.equal(layout.length, 4);
  for (const entry of layout) {
    assert.equal(library.has(entry.preset), true);
    assert.equal(Object.isFrozen(entry.position), true);
  }
});

test('showcase layout rejects invalid seeds and positions', () => {
  assert.throws(
    () =>
      parseTreeShowcaseLayout({
        layout: [
          {
            preset: 'tree',
            seed: -1,
            position: [0, 0, 0],
          },
        ],
      }),
    /unsigned 32-bit integer/,
  );
  assert.throws(
    () =>
      parseTreeShowcaseLayout({
        layout: [
          {
            preset: 'tree',
            seed: 1,
            position: [0, 0],
          },
        ],
      }),
    /three numbers/,
  );
});
