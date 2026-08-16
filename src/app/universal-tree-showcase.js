import * as THREE from 'three';
import { logger } from '../core/logger.js';
import { FrameBudgetQueue } from '../generation/frame-budget-queue.js';
import { TreeBillboardBatchManager } from '../rendering/tree-billboard-batch-manager.js';
import { TreeImpostorRenderer } from '../rendering/tree-impostor-renderer.js';
import { TreeLodController } from '../rendering/tree-lod-controller.js';
import { measureViewport } from '../rendering/viewport-size.js';
import { disposeObject } from '../rendering/object-disposer.js';
import { createDemoOverlay, showFatalError } from '../ui/demo-overlay.js';

export class UniversalTreeShowcase {
  constructor({ sceneFactory, treeGenerator, treeMeshBuilder }) {
    if (!sceneFactory || typeof sceneFactory.create !== 'function') {
      throw new TypeError('UniversalTreeShowcase requires a SceneFactory.');
    }
    if (!treeGenerator || typeof treeGenerator.generateIr !== 'function') {
      throw new TypeError('UniversalTreeShowcase requires a TreeGenerator.');
    }
    if (!treeMeshBuilder || typeof treeMeshBuilder.build !== 'function') {
      throw new TypeError('UniversalTreeShowcase requires a tree mesh builder.');
    }
    this.sceneFactory = sceneFactory;
    this.treeGenerator = treeGenerator;
    this.treeMeshBuilder = treeMeshBuilder;
    this.generationQueue = new FrameBudgetQueue();
    this.treeRoots = [];
    this.clock = new THREE.Clock();
    this.render = this.render.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.destroyed = true;
  }

  start(container, sceneConfig, library, layout) {
    this.container = container;
    this.sceneConfig = sceneConfig;
    this.library = library;
    this.layout = layout;
    this.viewportHeight = measureViewport(container).height;
    this.context = this.sceneFactory.create(container, sceneConfig);
    this.destroyed = false;
    this.impostorRenderer = new TreeImpostorRenderer(this.context.renderer);
    this.impostorRenderer.configureLights(
      this.context.sun.position.clone().normalize(),
      sceneConfig.lighting,
    );
    this.billboardBatchManager = new TreeBillboardBatchManager(this.context.scene);
    this.lodController = new TreeLodController(
      sceneConfig.lod,
      this.generationQueue,
    );

    const labels = [];
    for (const entry of layout) {
      const preset = library.get(entry.preset);
      if (!preset) {
        throw new Error(`Showcase references unknown tree preset '${entry.preset}'.`);
      }
      labels.push(preset.label);
      this.addTree(entry, preset);
    }

    this.overlay = createDemoOverlay(
      container,
      labels,
      'Universal Tree IR Showcase',
    );
    window.addEventListener('resize', this.handleResize);
    this.context.renderer.setAnimationLoop(this.render);
    logger.info('Universal Tree IR showcase started.', {
      treeCount: this.treeRoots.length,
      presets: labels,
    });
  }

  addTree(entry, preset) {
    const treeIr = this.treeGenerator.generateIr(preset, entry.seed);
    let root = null;
    try {
      root = this.treeMeshBuilder.build(treeIr, {
        sunDirection: this.context.sun.position.clone().normalize(),
        impostorRenderer: this.impostorRenderer,
        deferHero: true,
        minimumLod: 0,
      });
      root.position.fromArray(entry.position);
      root.rotation.y = entry.rotationY;
      root.updateMatrixWorld(true);
      root.userData.lod.billboardBatchManager = this.billboardBatchManager;
      this.billboardBatchManager.register(root);
      this.context.scene.add(root);
      this.treeRoots.push(root);
      this.lodController.register(root);
    } catch (error) {
      if (root) disposeObject(root);
      throw error;
    }
  }

  handleResize() {
    if (this.destroyed || !this.context) return;
    const { camera, renderer } = this.context;
    const { width, height } = measureViewport(this.container);
    this.viewportHeight = height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  render() {
    if (this.destroyed || !this.context) return;
    try {
      this.generationQueue.process(this.sceneConfig.lod.generationBudgetMs);
      this.context.controls.update();
      this.lodController.update(
        this.context.camera,
        this.viewportHeight,
        this.context.renderer,
      );
      this.context.renderer.render(this.context.scene, this.context.camera);
    } catch (error) {
      logger.error('Universal Tree IR showcase render failed.', error);
      const container = this.container;
      this.destroy();
      if (container) showFatalError(container, error);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('resize', this.handleResize);
    this.context?.renderer?.setAnimationLoop(null);
    this.generationQueue.clear();
    this.lodController?.clear();
    this.billboardBatchManager?.clear();
    for (const root of this.treeRoots) {
      this.context?.scene?.remove(root);
      disposeObject(root);
    }
    this.treeRoots.length = 0;
    this.overlay?.remove?.();
    this.context?.controls?.dispose?.();
    this.context?.renderer?.dispose?.();
    this.context = null;
  }
}
