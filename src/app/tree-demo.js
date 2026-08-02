import * as THREE from 'three';
import { TreeWindController } from '../animation/tree-wind-controller.js';
import {
  createStressSceneConfig,
  isStressSceneRequested,
} from './stress-scene.js';
import { logger } from '../core/logger.js';
import { CanopySolidityProbe } from '../diagnostics/canopy-solidity-probe.js';
import { RenderSmokeProbe } from '../diagnostics/render-smoke-probe.js';
import { FrameBudgetQueue } from '../generation/frame-budget-queue.js';
import { TreeGenerator } from '../generation/tree-generator.js';
import { disposeObject } from '../rendering/object-disposer.js';
import { SceneFactory } from '../rendering/scene-factory.js';
import { TreeMeshBuilder } from '../rendering/tree-mesh-builder.js';
import { TreeBillboardBatchManager } from '../rendering/tree-billboard-batch-manager.js';
import { TreeLodController } from '../rendering/tree-lod-controller.js';
import { createDemoOverlay } from '../ui/demo-overlay.js';

export class TreeDemo {
  constructor({
    sceneFactory = new SceneFactory(),
    treeGenerator = new TreeGenerator(),
    treeMeshBuilder = new TreeMeshBuilder(),
    windController = new TreeWindController(),
    renderSmokeProbe = new RenderSmokeProbe(),
    canopySolidityProbe = new CanopySolidityProbe(),
  } = {}) {
    this.sceneFactory = sceneFactory;
    this.treeGenerator = treeGenerator;
    this.treeMeshBuilder = treeMeshBuilder;
    this.windController = windController;
    this.renderSmokeProbe = renderSmokeProbe;
    this.canopySolidityProbe = canopySolidityProbe;
    this.generationQueue = new FrameBudgetQueue();
    this.treeRoots = [];
    this.generation = 0;
    this.clock = new THREE.Clock();
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.render = this.render.bind(this);
    this.stressSamples = [];
    this.stressReported = false;
  }

  start(container, sceneConfig, presetMap, releaseVersion, overlayTitle) {
    this.container = container;
    this.stressMode = isStressSceneRequested();
    this.sceneConfig = this.stressMode
      ? createStressSceneConfig(sceneConfig)
      : sceneConfig;
    this.presetMap = presetMap;
    this.context = this.sceneFactory.create(container, this.sceneConfig);
    this.applyRequestedView();
    this.billboardBatchManager = new TreeBillboardBatchManager(this.context.scene);
    this.lodController = new TreeLodController(
      this.sceneConfig.lod,
      this.generationQueue,
    );
    this.renderSmokeProbe.install(this.context.renderer);

    const labels = [...new Set(this.sceneConfig.layout.map((entry) => {
      const preset = presetMap.get(entry.preset);

      if (!preset) {
        throw new Error(`Layout references unknown tree preset '${entry.preset}'.`);
      }

      return preset.label;
    }))];

    this.canopySolidityProbe.install();
    createDemoOverlay(container, labels, overlayTitle);
    this.rebuildTrees();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    this.context.renderer.setAnimationLoop(this.render);
    void this.renderSmokeProbe.compile(
      this.context.renderer,
      this.context.scene,
      this.context.camera,
    );
    void this.runCanopySolidityProbe();
    logger.info('Procedural tree demo started.', {
      releaseVersion,
      presets: labels,
      treeCount: this.sceneConfig.layout.length,
      stressMode: this.stressMode,
    });
  }

  rebuildTrees() {
    this.generationQueue.clear();
    this.billboardBatchManager.clear();
    for (const root of this.treeRoots) {
      this.context.scene.remove(root);
      disposeObject(root);
    }

    this.treeRoots.length = 0;
    this.lodController.clear();
    this.windController.clear();

    const generation = this.generation;
    const buildEntry = (entry) => {
      const preset = this.presetMap.get(entry.preset);
      const seed = Number(entry.seed) + generation * 1009;
      const treeData = this.treeGenerator.generate(preset, seed, {
        includeSurfaceSamples: !this.stressMode,
      });
      const tree = this.treeMeshBuilder.build(treeData, {
        sunDirection: this.context.sun.position.clone().normalize(),
        deferHero: !this.renderSmokeProbe.enabled,
        minimumLod:
          this.stressMode && Number(entry.position[2]) <= -160 ? 3 :
            this.stressMode ? 2 : 0,
      });
      tree.position.fromArray(entry.position);
      tree.rotation.y = Number(entry.rotationY ?? 0);
      this.context.scene.add(tree);
      this.treeRoots.push(tree);
      tree.updateMatrixWorld(true);
      tree.userData.lod.billboardBatchManager = this.billboardBatchManager;
      this.billboardBatchManager.register(tree);
      this.lodController.register(tree);
      this.windController.register(tree, seed);
      this.context.renderer.shadowMap.needsUpdate = true;
    };

    for (const [index, entry] of this.sceneConfig.layout.entries()) {
      if (this.stressMode) {
        this.generationQueue.enqueue(`tree:${generation}:${index}`, () =>
          buildEntry(entry),
        );
      } else {
        buildEntry(entry);
      }
    }

    this.generation += 1;
    this.context.renderer.shadowMap.needsUpdate = true;
  }

  async runCanopySolidityProbe() {
    if (!this.canopySolidityProbe.enabled) return;

    // One presented frame guarantees every hero material has compiled before the
    // probe reads pixels back from its own render target.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await this.canopySolidityProbe.run({
      renderer: this.context.renderer,
      scene: this.context.scene,
      trees: this.treeRoots,
    });
  }

  handleResize() {
    const { camera, renderer } = this.context;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  handleKeyDown(event) {
    if (event.key.toLowerCase() === 'r' && !event.repeat) {
      this.rebuildTrees();
    }
  }

  render() {
    const elapsed = this.clock.getElapsedTime();
    this.generationQueue.process(this.sceneConfig.lod.generationBudgetMs);
    this.windController.update(elapsed);
    this.context.controls.update();
    this.lodController.update(
      this.context.camera,
      this.container.clientHeight,
      this.context.renderer,
    );
    this.context.renderer.render(this.context.scene, this.context.camera);
    this.updateStressReport();
  }

  applyRequestedView() {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view !== 'close') return;

    this.context.camera.position.set(13, 6.3, 9.2);
    this.context.controls.target.set(5.4, 4.2, 0.5);
    this.context.camera.updateProjectionMatrix();
    this.context.controls.update();
  }

  updateStressReport() {
    if (
      !this.stressMode ||
      this.stressReported ||
      this.generationQueue.length > 0 ||
      this.treeRoots.length !== this.sceneConfig.layout.length
    ) {
      return;
    }
    this.stressSamples.push({
      time: performance.now(),
      drawCalls: this.context.renderer.info.render.calls,
      triangles: this.context.renderer.info.render.triangles,
    });
    if (this.stressSamples.length < 10) return;
    const first = this.stressSamples[0];
    const last = this.stressSamples.at(-1);
    const fps = ((this.stressSamples.length - 1) * 1000) / (last.time - first.time);
    const maximumDrawCalls = Math.max(
      ...this.stressSamples.map((sample) => sample.drawCalls),
    );
    const maximumTriangles = Math.max(
      ...this.stressSamples.map((sample) => sample.triangles),
    );
    const root = document.documentElement;
    root.dataset.stressStatus = maximumDrawCalls <= 100 ? 'ready' : 'error';
    root.dataset.stressTreeCount = String(this.treeRoots.length);
    root.dataset.stressFps = fps.toFixed(1);
    root.dataset.stressDrawCalls = String(maximumDrawCalls);
    root.dataset.stressTriangles = String(maximumTriangles);
    root.dataset.stressGenerationMaxMs =
      this.generationQueue.maximumTaskDuration.toFixed(2);
    this.stressReported = true;
    const query = new URLSearchParams({
      status: root.dataset.stressStatus,
      error:
        maximumDrawCalls <= 100
          ? ''
          : `Stress draw calls ${maximumDrawCalls} exceeded 100.`,
    });
    void fetch(`/__render-smoke-status?${query}`, {
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.context?.renderer.setAnimationLoop(null);
    this.context?.controls.dispose();

    for (const root of this.treeRoots) {
      disposeObject(root);
    }

    this.context?.renderer.dispose();
    this.treeRoots.length = 0;
    this.lodController?.clear();
    this.billboardBatchManager?.clear();
    this.generationQueue.clear();
    this.windController.clear();
  }
}
