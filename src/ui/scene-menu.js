import { FOREST_SIZES } from '../app/forest-scene.js';
import { SEASONS } from '../app/season.js';
import { FOREST_SCENE, GARDEN_SCENE } from '../app/tree-demo.js';
import { PerformanceHud } from './performance-hud.js';
import { createElement } from './tuning-controls.js';

/**
 * The scene menu.
 *
 * The studio panel answers 'what does one tree look like'. This one answers the
 * other question the project keeps asking of itself: what happens when there
 * are hundreds of them, all at different levels of detail, and the camera is
 * standing underneath rather than orbiting outside. Picking a scene, a size and
 * a way to move are the whole of it; the readout underneath is the answer.
 *
 * The control classes are shared with the studio panel, because they are the
 * page's control primitives rather than that panel's private styling.
 */

const SCENES = Object.freeze([
  Object.freeze({ id: GARDEN_SCENE, label: 'Studio garden' }),
  Object.freeze({ id: FOREST_SCENE, label: 'Forest glade' }),
]);

const CAMERA_MODES = Object.freeze([
  Object.freeze({
    id: 'orbit',
    label: 'Orbit',
    hint: 'Drag to orbit, scroll to zoom.',
  }),
  Object.freeze({
    id: 'walk',
    label: 'Walk',
    hint: 'WASD or arrows to walk, Shift to run. Click the view for mouse look, Esc to release it.',
  }),
  Object.freeze({
    id: 'fly',
    label: 'Fly',
    hint: 'WASD to fly where you look, Space and C for height, Shift for speed. Click the view for mouse look, Esc to release it.',
  }),
]);

function createButton(label, className = 'tuning-button') {
  const button = createElement('button', className, label);
  button.type = 'button';
  return button;
}

function createRow(label, control) {
  const row = createElement('div', 'tuning-row');
  row.append(createElement('label', 'tuning-inline-label', label), control);
  return row;
}

export class SceneMenu {
  constructor(demo, { onSceneChange = () => {} } = {}) {
    this.demo = demo;
    this.onSceneChange = onSceneChange;
    this.hud = new PerformanceHud();
  }

  mount(container) {
    this.root = createElement('aside', 'scene-menu');
    this.root.setAttribute('aria-label', 'Scene');
    this.body = createElement('div', 'scene-menu-body');
    this.body.append(
      this.createSceneRow(),
      this.createSizeRow(),
      this.createSeasonRow(),
      this.createCameraRow(),
      this.createActionRow(),
      this.createHint(),
      this.createStatus(),
      this.hud.element,
    );
    this.root.append(this.createHeader(), this.body);
    container.append(this.root);

    this.refresh();
    this.unsubscribe = this.demo.addFrameListener((sample) => this.report(sample));
    return this.root;
  }

  createHeader() {
    const header = createElement('header', 'scene-menu-header');
    this.collapseButton = createButton('–', 'tuning-collapse');
    this.collapseButton.title = 'Hide the scene menu';
    this.collapseButton.addEventListener('click', () => this.toggleCollapsed());
    header.append(createElement('h2', null, 'Scene'), this.collapseButton);
    return header;
  }

  toggleCollapsed() {
    const collapsed = this.root.classList.toggle('is-collapsed');
    this.collapseButton.textContent = collapsed ? '+' : '–';
    this.collapseButton.title = collapsed
      ? 'Show the scene menu'
      : 'Hide the scene menu';
  }

  createSceneRow() {
    this.sceneSelect = createElement('select', 'tuning-select');
    for (const scene of SCENES) {
      const option = createElement('option', null, scene.label);
      option.value = scene.id;
      this.sceneSelect.append(option);
    }
    this.sceneSelect.addEventListener('change', () => {
      // The studio's solo tree would otherwise stay in front of the scene that
      // was just asked for.
      this.onSceneChange(this.sceneSelect.value);
      this.demo.setScene(this.sceneSelect.value);
      this.refresh();
    });
    return createRow('Scene', this.sceneSelect);
  }

  createSizeRow() {
    this.sizeSelect = createElement('select', 'tuning-select');
    for (const size of Object.values(FOREST_SIZES)) {
      const option = createElement('option', null, size.label);
      option.value = size.id;
      option.title = `${size.radius} m across the trees, ${size.clearingRadius} m of clearing`;
      this.sizeSelect.append(option);
    }
    this.sizeSelect.addEventListener('change', () => {
      this.demo.setForestSize(this.sizeSelect.value);
      this.refresh();
    });
    this.sizeRow = createRow('Size', this.sizeSelect);
    return this.sizeRow;
  }

  createSeasonRow() {
    this.seasonSelect = createElement('select', 'tuning-select');
    for (const season of SEASONS) {
      const option = createElement('option', null, season.label);
      option.value = season.id;
      this.seasonSelect.append(option);
    }
    this.seasonSelect.title =
      'Turns the light, the ground and every crown in the scene at once.';
    this.seasonSelect.addEventListener('change', () => {
      this.demo.setSeason(this.seasonSelect.value);
      this.refresh();
    });
    return createRow('Season', this.seasonSelect);
  }

  createCameraRow() {
    const group = createElement('div', 'scene-menu-modes');
    this.modeButtons = new Map();

    for (const mode of CAMERA_MODES) {
      const button = createButton(mode.label, 'tuning-button scene-menu-mode');
      button.title = mode.hint;
      button.addEventListener('click', () => {
        this.demo.setCameraMode(mode.id);
        this.refresh();
      });
      this.modeButtons.set(mode.id, button);
      group.append(button);
    }

    return createRow('Camera', group);
  }

  createActionRow() {
    const reseed = createButton('New forest');
    reseed.title = 'Lay the trees out again from a different seed';
    reseed.addEventListener('click', () => this.demo.reseedScene());

    this.readoutInput = createElement('input');
    this.readoutInput.type = 'checkbox';
    this.readoutInput.checked = true;
    this.readoutInput.addEventListener('change', () =>
      this.hud.setVisible(this.readoutInput.checked),
    );
    const readoutLabel = createElement('label', 'tuning-checkbox');
    readoutLabel.append(
      this.readoutInput,
      createElement('span', null, 'Readout'),
    );

    const row = createElement('div', 'tuning-row tuning-row-actions');
    row.append(readoutLabel, reseed);
    return row;
  }

  createHint() {
    this.hint = createElement('p', 'scene-menu-hint');
    return this.hint;
  }

  createStatus() {
    this.status = createElement('p', 'tuning-status');
    this.status.setAttribute('role', 'status');
    return this.status;
  }

  /** Puts the controls back in step with whatever the demo is actually doing. */
  refresh() {
    const forest = this.demo.sceneId === FOREST_SCENE;
    this.sceneSelect.value = this.demo.sceneId;
    this.sizeSelect.value = this.demo.forestSize;
    this.seasonSelect.value = this.demo.season;
    this.sizeSelect.disabled = !forest;
    this.sizeRow.hidden = !forest;

    for (const [id, button] of this.modeButtons) {
      button.dataset.active = String(id === this.demo.cameraMode);
    }

    this.hint.textContent =
      CAMERA_MODES.find((mode) => mode.id === this.demo.cameraMode)?.hint ?? '';
    this.hud.setVisible(this.readoutInput.checked);
  }

  report(sample) {
    this.hud.update(sample);

    if (sample.built < sample.total) {
      this.setStatus(
        `Planting — ${sample.built} of ${sample.total} trees.`,
        'info',
      );
      return;
    }

    if (sample.cameraMode !== 'orbit' && !sample.pointerLocked) {
      this.setStatus('Click the view to look around.', 'warn');
      return;
    }

    this.setStatus(
      `${sample.total} trees · ${sample.fps.toFixed(0)} fps · ${sample.drawCalls} draws.`,
      'pass',
    );
  }

  setStatus(message, tone) {
    if (this.status.textContent === message) return;

    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  destroy() {
    this.unsubscribe?.();
    this.root?.remove();
  }
}

export function createSceneMenu(container, demo, options) {
  const menu = new SceneMenu(demo, options);
  menu.mount(container);
  return menu;
}
