import { dump } from 'js-yaml';
import { logger } from '../core/logger.js';
import { PresetVariantStore, toPresetId } from './preset-variant-store.js';
import { createControl, createElement } from './tuning-controls.js';
import {
  evaluateTuningCoverage,
  tuningCoverageAutoFitTargets,
} from './tuning-coverage-policy.js';
import { TUNING_GROUPS, writePath } from './tuning-schema.js';

/**
 * The side studio.
 *
 * Editing works on a detached copy of the preset configuration. A committed
 * change is validated by the preset factory before the scene sees it, so an
 * out-of-range combination reports an error and leaves the current tree alone
 * rather than tearing the demo down.
 *
 * Coverage is reported next to the controls because it is the property that
 * makes or breaks a tuned preset: a crown can look right in one view and still
 * have a bald patch on the far side, and the numbers say so before you orbit
 * round to find it.
 */

const COMMIT_DELAY_MS = 90;
const DEFAULT_COVERAGE_THRESHOLDS = Object.freeze({
  maximumCandidateCoverageRatio: 1.000001,
  gapCardRatio: 0.85,
  minimumLeafAreaIndex: 6.5,
  bareExposedLobes: 0,
});
// Packing tighter than this stops buying coverage and only costs triangles.
const MINIMUM_COVERAGE_CARD_RATIO = 0.2;
// Each attempt costs a full regeneration, so the step is solved rather than
// nudged; the cap only guarantees forward progress when the solve undershoots.
const AUTO_FIT_MAXIMUM_STEP = 0.95;
const AUTO_FIT_ATTEMPTS = 5;

function createRow(className, children) {
  const row = createElement('div', className);
  row.append(...children);
  return row;
}

function createButton(label, className = 'tuning-button') {
  const button = createElement('button', className, label);
  button.type = 'button';
  return button;
}

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
  const link = createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export class TuningPanel {
  constructor(
    demo,
    library,
    { store = new PresetVariantStore(), coverageThresholds = null } = {},
  ) {
    this.demo = demo;
    this.library = library;
    this.store = store;
    this.coverageThresholds = coverageThresholds;
    this.presetId = library.ids[0];
    this.config = library.rawValue(this.presetId);
    this.controls = [];
    this.commitTimer = null;
    this.activeApply = null;
    this.activeApplyConfig = null;
    this.sceneRevision = 0;
  }

  mount(container) {
    this.root = createElement('aside', 'tuning-panel');
    this.root.setAttribute('aria-label', 'Tree studio');
    this.root.append(
      this.createHeader(),
      this.createPresetRow(),
      this.createSceneRow(),
      this.createGroups(),
      this.createCoverage(),
      this.createVariants(),
      this.createStatus(),
    );
    // Collapsed on arrival, so the demo looks exactly as it does without the
    // studio. Opening it is what switches the scene to the single tree being
    // edited, and closing it puts the whole scene back.
    this.root.classList.add('is-collapsed');
    container.append(this.root);
    this.refreshControls();
    return this.root;
  }

  createHeader() {
    const header = createElement('header', 'tuning-header');
    const title = createElement('h2', null, 'Tree studio');
    this.collapseButton = createButton('+', 'tuning-collapse');
    this.collapseButton.title = 'Open the studio';
    this.collapseButton.addEventListener('click', () => this.toggleCollapsed());
    header.append(title, this.collapseButton);
    return header;
  }

  setCollapsedVisual(collapsed) {
    this.root.classList.toggle('is-collapsed', collapsed);
    this.collapseButton.textContent = collapsed ? '+' : '–';
    this.collapseButton.title = collapsed
      ? 'Open the studio'
      : 'Close the studio and restore the scene';
  }

  tryStudioPreset(presetId) {
    try {
      this.demo.setStudioPreset(presetId);
      this.sceneRevision += 1;
      return true;
    } catch (error) {
      logger.error('Failed to change the studio scene.', error);
      this.setStatus(error.message, 'error');
      return false;
    }
  }

  toggleCollapsed() {
    const collapsed = !this.root.classList.contains('is-collapsed');
    const presetId = collapsed || !this.soloInput.checked ? null : this.presetId;

    if (!this.tryStudioPreset(presetId)) return false;

    this.setCollapsedVisual(collapsed);
    this.refreshCoverage();
    return true;
  }

  /**
   * Closes the studio without restoring anything.
   *
   * Used when something else is about to replace the scene: the solo tree is
   * already on its way out, and asking for the previous layout back first would
   * generate a scene nobody sees.
   */
  collapse() {
    if (this.root.classList.contains('is-collapsed')) return;

    this.root.classList.add('is-collapsed');
    this.collapseButton.textContent = '+';
    this.collapseButton.title = 'Open the studio';
  }

  createPresetRow() {
    this.presetSelect = createElement('select', 'tuning-select');
    for (const id of this.library.ids) {
      const option = createElement('option', null, this.library.get(id).label);
      option.value = id;
      this.presetSelect.append(option);
    }
    this.presetSelect.addEventListener('change', () =>
      this.selectPreset(this.presetSelect.value),
    );

    const label = createElement('label', 'tuning-inline-label', 'Preset');
    return createRow('tuning-row', [label, this.presetSelect]);
  }

  createSceneRow() {
    this.soloInput = createElement('input');
    this.soloInput.type = 'checkbox';
    this.soloInput.checked = true;
    this.soloInput.addEventListener('change', () => {
      const requested = this.soloInput.checked;
      if (!this.applySolo()) this.soloInput.checked = !requested;
    });

    const soloLabel = createElement('label', 'tuning-checkbox');
    soloLabel.append(this.soloInput, createElement('span', null, 'Solo'));

    const reseed = createButton('New seed');
    reseed.addEventListener('click', () => this.reseedScene());

    const frame = createButton('Frame');
    frame.title = 'Point the camera at the edited tree';
    frame.addEventListener('click', () => this.demo.frameStudioTree(this.presetId));

    return createRow('tuning-row tuning-row-actions', [soloLabel, reseed, frame]);
  }

  createGroups() {
    const wrapper = createElement('div', 'tuning-groups');
    const context = {
      config: this.config,
      onPreview: () => {},
      onCommit: (path, value) => this.commit(path, value),
    };
    this.controlContext = context;

    for (const group of TUNING_GROUPS) {
      const details = createElement('details', 'tuning-group');
      details.open = group.open;
      details.append(createElement('summary', null, group.label));
      if (group.note) details.append(createElement('p', 'tuning-note', group.note));

      for (const control of group.controls) {
        const instance = createControl(control, context);
        this.controls.push(instance);
        details.append(instance.element);
      }

      wrapper.append(details);
    }

    return wrapper;
  }

  createCoverage() {
    const section = createElement('section', 'tuning-coverage');
    section.append(createElement('h3', null, 'Coverage'));
    this.coverageRows = new Map();

    const rows = [
      ['gap', 'Worst gap', 'card widths'],
      ['leafArea', 'Leaf area', 'per crown area'],
      ['bare', 'Bare lobes', ''],
      ['clusters', 'Leaf clusters', ''],
    ];

    for (const [key, label, unit] of rows) {
      const row = createElement('div', 'tuning-metric');
      const value = createElement('span', 'tuning-metric-value', '–');
      row.append(createElement('span', 'tuning-metric-label', label), value);
      if (unit) row.title = unit;
      this.coverageRows.set(key, value);
      section.append(row);
    }

    this.autoFitButton = createButton('Close the gaps');
    this.autoFitButton.title =
      'Pack leaf cards tighter until the worst gap is narrower than a card';
    this.autoFitButton.addEventListener('click', () => this.autoFitCoverage());
    section.append(this.autoFitButton);
    return section;
  }

  createVariants() {
    const section = createElement('section', 'tuning-variants');
    section.append(createElement('h3', null, 'Saved settings'));

    this.variantSelect = createElement('select', 'tuning-select');
    this.nameInput = createElement('input', 'tuning-text');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Name this setting';

    const save = createButton('Save');
    save.addEventListener('click', () => this.saveVariant());
    const load = createButton('Load');
    load.addEventListener('click', () => void this.loadVariant());
    const remove = createButton('Delete');
    remove.addEventListener('click', () => this.deleteVariant());
    const exportButton = createButton('Export YAML');
    exportButton.addEventListener('click', () => this.exportVariants());

    section.append(
      createRow('tuning-row', [this.nameInput, save]),
      createRow('tuning-row', [this.variantSelect]),
      createRow('tuning-row tuning-row-actions', [load, remove, exportButton]),
    );
    this.refreshVariants();
    return section;
  }

  createStatus() {
    this.status = createElement('p', 'tuning-status', 'Ready.');
    this.status.setAttribute('role', 'status');
    return this.status;
  }

  setStatus(message, tone = 'info') {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  selectPreset(presetId) {
    // A slider commit is delayed to avoid rebuilding continuously. Persist it
    // before replacing the detached editor value, or a quick preset switch
    // would silently discard the last edit.
    this.flushScheduledApply();

    const previousPresetId = this.presetId;
    const previousConfig = this.config;
    this.presetId = presetId;
    this.config = this.library.rawValue(presetId);
    this.controlContext.config = this.config;
    this.presetSelect.value = presetId;
    this.refreshControls();

    if (
      !this.root.classList.contains('is-collapsed') &&
      !this.applySolo()
    ) {
      this.presetId = previousPresetId;
      this.config = previousConfig;
      this.controlContext.config = this.config;
      this.presetSelect.value = previousPresetId;
      this.refreshControls();
      return false;
    }

    return true;
  }

  refreshControls() {
    for (const control of this.controls) control.refresh();
  }

  commit(path, value) {
    const next = structuredClone(this.config);
    writePath(next, path, value);

    // Taper is part of what a style is. Picking a new one adopts its taper
    // rather than keeping a number tuned for the shape you just left; the
    // slider moves to show it.
    if (path === 'trunk.style') delete next.trunk.taperPower;

    this.config = next;
    this.controlContext.config = next;
    if (path === 'trunk.style') this.refreshControls();
    this.scheduleApply();
  }

  scheduleApply() {
    if (this.commitTimer !== null) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      void this.apply();
    }, COMMIT_DELAY_MS);
  }

  flushScheduledApply() {
    if (this.commitTimer === null) return true;

    clearTimeout(this.commitTimer);
    this.commitTimer = null;
    return this.storeConfiguration(this.presetId, this.config);
  }

  settlePendingApply() {
    const scheduled = this.commitTimer !== null;
    if (scheduled) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }

    if (this.activeApply && this.activeApplyConfig === this.config) {
      return this.activeApply;
    }
    if (!scheduled && !this.activeApply) return Promise.resolve(true);
    return this.apply();
  }

  storeConfiguration(presetId, config) {
    const previous = this.library.rawValue(presetId);

    try {
      this.library.set(presetId, config);
      return true;
    } catch (error) {
      // Only roll the visible editor back when it still represents the value
      // that failed. A stale delayed apply must never overwrite a newer preset.
      if (this.presetId === presetId && this.config === config) {
        this.config = previous;
        this.controlContext.config = this.config;
        this.refreshControls();
      }
      this.setStatus(error.message, 'error');
      return false;
    }
  }

  restoreConfiguration(presetId, previous, failedConfig) {
    this.library.set(presetId, previous);

    if (this.presetId === presetId && this.config === failedConfig) {
      this.config = previous;
      this.controlContext.config = this.config;
      this.refreshControls();
    }
  }

  /**
   * Validates, swaps the preset in and rebuilds. A rejected configuration is
   * reported and rolled back so the panel and the scene never disagree.
   *
   * Resolves once the new tree is on screen, so a caller that needs to measure
   * the result can wait for it rather than reading the previous tree back.
   */
  apply() {
    const presetId = this.presetId;
    const config = this.config;
    const previous = this.library.rawValue(presetId);
    const sceneRevision = this.sceneRevision;

    if (!this.storeConfiguration(presetId, config)) return Promise.resolve(false);

    this.setStatus('Generating…');

    // Yield once so the status text can paint before the synchronous
    // generate-and-build blocks the main thread. A timer rather than a frame
    // callback, because a backgrounded tab never runs frame callbacks and the
    // edit would sit unapplied until the tab came forward.
    const operation = new Promise((resolve) => {
      setTimeout(() => {
        // The user may switch presets, make another edit or rebuild the scene
        // while this paint-yield is pending. That newer scene already consumed
        // the stored configuration, so this operation must not rebuild or roll
        // it back afterward.
        if (
          this.presetId !== presetId ||
          this.config !== config ||
          this.sceneRevision !== sceneRevision
        ) {
          resolve(true);
          return;
        }

        try {
          this.demo.rebuildPreset(presetId);
          this.sceneRevision += 1;
          this.refreshCoverage();
          resolve(true);
        } catch (error) {
          try {
            this.restoreConfiguration(presetId, previous, config);
          } catch (rollbackError) {
            logger.error('Failed to roll back the tuned preset.', rollbackError);
          }
          logger.error('Failed to rebuild the tuned preset.', error);
          this.setStatus(error.message, 'error');
          resolve(false);
        }
      }, 0);
    });

    this.activeApply = operation;
    this.activeApplyConfig = config;
    void operation.finally(() => {
      if (this.activeApply !== operation) return;
      this.activeApply = null;
      this.activeApplyConfig = null;
    });
    return operation;
  }

  applySolo() {
    if (!this.tryStudioPreset(this.soloInput.checked ? this.presetId : null)) {
      return false;
    }

    this.refreshCoverage();
    return true;
  }

  reseedScene() {
    try {
      this.demo.reseed();
      this.sceneRevision += 1;
      this.refreshCoverage();
      return true;
    } catch (error) {
      logger.error('Failed to generate a new tree seed.', error);
      this.setStatus(error.message, 'error');
      return false;
    }
  }

  coverageThresholdsForPreset(presetId = this.presetId) {
    return this.coverageThresholds
      ? this.coverageThresholds[presetId]
      : DEFAULT_COVERAGE_THRESHOLDS;
  }

  refreshCoverage() {
    let report;
    try {
      report = this.demo.analyzeCoverage(this.presetId);
    } catch (error) {
      for (const value of this.coverageRows.values()) value.textContent = '–';
      logger.error('Failed to analyze studio coverage.', error);
      this.setStatus(error.message, 'error');
      return null;
    }

    if (!report) {
      for (const value of this.coverageRows.values()) value.textContent = '–';
      return null;
    }

    let evaluation;
    try {
      evaluation = evaluateTuningCoverage(
        report,
        this.coverageThresholdsForPreset(),
        this.presetId,
      );
    } catch (error) {
      logger.error('Failed to evaluate studio coverage.', error);
      this.setStatus(error.message, 'error');
      return report;
    }

    const checks = evaluation.checks;
    this.setMetric('gap', report.gapCardRatio.toFixed(3), checks.gapCardRatio);
    this.setMetric(
      'leafArea',
      report.leafAreaIndex.toFixed(2),
      checks.leafAreaIndex,
    );
    this.setMetric(
      'bare',
      String(report.bareExposedLobes),
      checks.bareExposedLobes,
    );
    this.setMetric('clusters', String(report.clusterCount), true);

    if (evaluation.passed) {
      this.setStatus('Covered: release coverage gates pass.', 'pass');
    } else if (!checks.gapCardRatio) {
      this.setStatus(
        `Gaps up to ${report.gapCardRatio.toFixed(2)} card widths. Close them.`,
        'warn',
      );
    } else if (!checks.bareExposedLobes) {
      this.setStatus(`${report.bareExposedLobes} lobes exceed the bare-lobe limit.`, 'warn');
    } else if (!checks.leafAreaIndex) {
      this.setStatus('Foliage is thinner than the configured coverage gate.', 'warn');
    } else if (!checks.continuousCoverage) {
      this.setStatus('Continuous crown coverage still has an uncovered patch.', 'warn');
    } else if (!checks.candidateCoverage) {
      this.setStatus('Candidate coverage exceeds the configured limit.', 'warn');
    } else {
      this.setStatus('Physical leaf-card coverage exceeds the safe limit.', 'warn');
    }

    return report;
  }

  setMetric(key, text, passed) {
    const element = this.coverageRows.get(key);
    element.textContent = text;
    element.dataset.state = passed ? 'pass' : 'warn';
  }

  /**
   * The packing ratio that would hit both coverage targets from here.
   *
   * The worst gap scales with the covering radius, so it is linear in the
   * packing ratio. Leaf area is the card area of everything the packing let in,
   * which goes as one over the ratio squared. Both are solved for directly and
   * the tighter answer wins, which converges in one or two regenerations rather
   * than a dozen fixed nudges.
   */
  solvePacking(report) {
    const current = this.config.foliage.shell.coverageCardRatio;
    const targets = tuningCoverageAutoFitTargets(
      this.coverageThresholdsForPreset(),
      this.presetId,
    );
    const forGap =
      report.gapCardRatio > 0
        ? current * (targets.gapCardRatio / report.gapCardRatio)
        : current;
    const forArea =
      report.leafAreaIndex > 0
        ? current * Math.sqrt(report.leafAreaIndex / targets.minimumLeafAreaIndex)
        : current;

    return Math.max(
      MINIMUM_COVERAGE_CARD_RATIO,
      Math.min(forGap, forArea, current * AUTO_FIT_MAXIMUM_STEP),
    );
  }

  /**
   * Packs leaf cards tighter until the worst gap on the crown is narrower than
   * a card and the canopy is as dense as the shipped presets.
   *
   * Coverage packing is the one knob that trades triangles for coverage without
   * changing the silhouette, which is why it is the one the button moves rather
   * than card size or lobe count.
   */
  async autoFitCoverage() {
    if (this.autoFitButton.disabled) return;

    this.autoFitButton.disabled = true;

    try {
      if (!(await this.settlePendingApply())) return;

      for (let attempt = 0; attempt < AUTO_FIT_ATTEMPTS; attempt += 1) {
        const report = this.refreshCoverage();

        if (!report) {
          this.setStatus('Nothing to measure yet.', 'warn');
          return;
        }

        let evaluation;
        try {
          evaluation = evaluateTuningCoverage(
            report,
            this.coverageThresholdsForPreset(),
            this.presetId,
          );
        } catch (error) {
          logger.error('Failed to evaluate studio coverage.', error);
          this.setStatus(error.message, 'error');
          return;
        }
        if (evaluation.passed) return;

        const current = this.config.foliage.shell.coverageCardRatio;
        const next = Number(this.solvePacking(report).toFixed(4));

        if (next >= current) break;

        const nextConfig = structuredClone(this.config);
        writePath(nextConfig, 'foliage.shell.coverageCardRatio', next);
        this.config = nextConfig;
        this.controlContext.config = nextConfig;
        this.refreshControls();

        if (!(await this.apply())) return;
      }

      this.setStatus(
        'Packed as tight as it goes. Try more lobes or a lower exposure threshold.',
        'warn',
      );
    } finally {
      this.autoFitButton.disabled = false;
    }
  }

  saveVariant() {
    const name = this.nameInput.value.trim();

    if (!name) {
      this.setStatus('Name the setting before saving it.', 'warn');
      return;
    }

    try {
      this.library.validate(this.presetId, this.config);
    } catch (error) {
      this.setStatus(error.message, 'error');
      return;
    }

    const saved = this.store.save(name, this.presetId, this.config);
    this.refreshVariants(name);
    this.setStatus(
      saved ? `Saved '${name}'.` : `Saved '${name}' for this session only.`,
      saved ? 'pass' : 'warn',
    );
  }

  async loadVariant() {
    const name = this.variantSelect.value;
    const variant = name ? this.store.load(name) : null;

    if (!variant) {
      this.setStatus('Select a saved setting first.', 'warn');
      return false;
    }

    if (!(await this.settlePendingApply())) return false;

    // A variant saved from a preset that has since been removed still loads
    // onto whichever preset is being edited now. Existing bases switch through
    // the same transactional path as the preset picker so a failed rebuild
    // cannot leave the panel describing a different tree from the scene.
    if (
      variant.basePresetId &&
      this.library.has(variant.basePresetId) &&
      variant.basePresetId !== this.presetId &&
      !this.selectPreset(variant.basePresetId)
    ) {
      return false;
    }

    this.config = variant.value;
    this.controlContext.config = this.config;
    this.refreshControls();
    this.nameInput.value = name;
    return this.apply();
  }

  deleteVariant() {
    const name = this.variantSelect.value;

    if (!name || !this.store.remove(name)) {
      this.setStatus('Select a saved setting first.', 'warn');
      return;
    }

    this.refreshVariants();
    this.setStatus(`Deleted '${name}'.`);
  }

  exportVariants() {
    const config = this.store.toPresetConfig();
    const names = Object.keys(config.presets);

    if (names.length === 0) {
      this.setStatus('Save a setting before exporting.', 'warn');
      return;
    }

    downloadText('tuned-tree-presets.yaml', dump(config, { lineWidth: 100 }));
    this.setStatus(`Exported ${names.length} settings as YAML.`, 'pass');
  }

  refreshVariants(selected) {
    const variants = this.store.list();
    this.variantSelect.replaceChildren();

    for (const variant of variants) {
      const base = this.library.has(variant.basePresetId)
        ? this.library.get(variant.basePresetId).label
        : toPresetId(variant.name);
      const option = createElement('option', null, `${variant.name} — ${base}`);
      option.value = variant.name;
      this.variantSelect.append(option);
    }

    if (variants.length === 0) {
      const option = createElement('option', null, 'Nothing saved yet');
      option.value = '';
      this.variantSelect.append(option);
    }

    if (selected) this.variantSelect.value = selected;
  }
}

export function createTuningPanel(container, demo, library, options) {
  const panel = new TuningPanel(demo, library, options);
  panel.mount(container);
  return panel;
}
