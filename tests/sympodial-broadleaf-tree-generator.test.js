import assert from 'node:assert/strict';
import test from 'node:test';
import { FoliagePrimitiveCompiler } from '../src/compilation/foliage-primitive-compiler.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { validateTreeIr } from '../src/generation/tree-ir-validator.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const config = readYamlConfigSync(
  new URL('../config/advanced-broadleaf-presets.yaml', import.meta.url),
);

function spreadingOak() {
  return PresetLibrary.fromConfig(config).get('spreadingOak');
}

test('sympodial broadleaf presets use a native model-specific schema', () => {
  const library = PresetLibrary.fromConfig(config);
  const preset = library.get('spreadingOak');

  assert.deepEqual(library.ids, ['spreadingOak', 'umbrellaBroadleaf']);
  assert.equal(preset.generationModel, 'sympodial-broadleaf');
  assert.equal(Object.hasOwn(preset, 'crown'), false);
  assert.equal(Object.hasOwn(preset.foliage, 'shell'), false);
  assert.equal(preset.morphology.leaderCount, 3);
});

test('sympodial broadleaf generation is deterministic with multiple mature leaders', () => {
  const generator = new TreeGenerator();
  const preset = spreadingOak();
  const first = generator.generateIr(preset, 57121);
  const second = generator.generateIr(preset, 57121);
  const leaders = first.stems.filter((stem) => stem.order === 1);
  const maximumOrder = Math.max(...first.stems.map((stem) => stem.order));

  assert.deepEqual(first, second);
  assert.doesNotThrow(() => validateTreeIr(first));
  assert.equal(first.generationModel, 'sympodial-broadleaf');
  assert.equal(leaders.length, preset.morphology.leaderCount);
  assert.ok(maximumOrder > 1);
  assert.ok(maximumOrder <= preset.morphology.branchingDepth);
  assert.ok(first.stems.length > leaders.length + 1);
  assert.ok(first.crownVolumes.length > leaders.length);
  assert.ok(first.foliageSites.length > first.crownVolumes.length);
  assert.equal(first.metadata.legacyRendererCompatible, false);
});

test('terminal broadleaf crowns organize into a spatially spread canopy', () => {
  const preset = spreadingOak();
  const ir = new TreeGenerator().generateIr(preset, 1201);
  const centers = ir.crownVolumes.map((volume) => volume.center);
  const xValues = centers.map((point) => point.x);
  const zValues = centers.map((point) => point.z);
  const horizontalSpan = Math.max(
    Math.max(...xValues) - Math.min(...xValues),
    Math.max(...zValues) - Math.min(...zValues),
  );

  assert.ok(horizontalSpan > preset.height * 0.2);
  assert.ok(
    new Set(ir.foliageGroups.map((group) => group.metadata.leaderIndex)).size >= 3,
  );
});

test('native broadleaf foliage compiles through the broadleaf backend', () => {
  const ir = new TreeGenerator().generateIr(spreadingOak(), 99);
  const plans = new FoliagePrimitiveCompiler().compile(ir, 'hero');

  assert.equal(plans.length, 1);
  assert.equal(plans[0].family, 'broadleaf');
  assert.equal(plans[0].backendId, 'broadleaf');
  assert.equal(plans[0].kind, 'hybrid-leaf-card');
});

test('sympodial broadleaf accepts deterministic environment shaping', () => {
  const generator = new TreeGenerator();
  const preset = spreadingOak();
  const baseline = generator.generateIr(preset, 887);
  const adapted = generator.generateIr(preset, 887, {
    environment: {
      groundNormal: [0.18, 0.98, 0.04],
      lightDirection: [1, 0.8, 0.2],
      lightBias: 0.8,
      prevailingWindDirection: [-1, 0, 0],
      windStrength: 0.6,
      competitionVolumes: [],
      pruningVolumes: [],
    },
  });

  assert.notDeepEqual(adapted.stems[0].path, baseline.stems[0].path);
  assert.equal(adapted.metadata.environment.applied, true);
});

test('legacy renderer adaptation stays explicit for native broadleaf topology', () => {
  assert.throws(
    () => new TreeGenerator().generate(spreadingOak(), 41),
    /no legacy renderer metadata/,
  );
});
