import * as THREE from 'three';
import { TreeWindController } from '../animation/tree-wind-controller.js';
import { logger } from '../core/logger.js';
import { TreeGenerator } from '../generation/tree-generator.js';
import { disposeObject } from '../rendering/object-disposer.js';
import { SceneFactory } from '../rendering/scene-factory.js';
import { TreeMeshBuilder } from '../rendering/tree-mesh-builder.js';
import { createDemoOverlay } from '../ui/demo-overlay.js';

export class TreeDemo {
  constructor({
    sceneFactory = new SceneFactory(),
    treeGenerator = new TreeGenerator(),
    treeMeshBuilder = new TreeMeshBuilder(),
    windController = new TreeWindController(),
  } = {}) {
    this.sceneFactory = sceneFactory;
    this.treeGenerator = treeGenerator;
    this.treeMeshBuilder = treeMeshBuilder;
    this.windController = windController;
    this.treeRoots = [];
    this.generation = 0;
    this.clock = new THREE.Clock();
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.render = this.render.bind(this);
  }

  start(container, sceneConfig, presetMap) {
    this.container = container;
    this.sceneConfig = sceneConfig;
    this.presetMap = presetMap;
    this.context = this.sceneFactory.create(container, sceneConfig);

    const labels = sceneConfig.layout.map((entry) => {
      const preset = presetMap.get(entry.preset);

      if (!preset) {
        throw new Error(`Layout references unknown tree preset '${entry.preset}'.`);
      }

      return preset.label;
    });

    createDemoOverlay(container, labels);
    this.rebuildTrees();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    this.context.renderer.setAnimationLoop(this.render);
    logger.info('Procedural tree demo started.', {
      presets: labels,
      treeCount: sceneConfig.layout.length,
    });
  }

  rebuildTrees() {
    for (const root of this.treeRoots) {
      this.context.scene.remove(root);
      disposeObject(root);
    }

    this.treeRoots.length = 0;
    this.windController.clear();
    const sunDirection = this.context.sun.position.clone().normalize();

    for (const entry of this.sceneConfig.layout) {
      const preset = this.presetMap.get(entry.preset);
      const seed = Number(entry.seed) + this.generation * 1009;
      const treeData = this.treeGenerator.generate(preset, seed);
      const tree = this.treeMeshBuilder.build(treeData, { sunDirection });
      tree.position.fromArray(entry.position);
      tree.rotation.y = Number(entry.rotationY ?? 0);
      this.context.scene.add(tree);
      this.treeRoots.push(tree);
      this.windController.register(tree, seed);
    }

    this.generation += 1;
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
    this.windController.update(elapsed);
    this.context.controls.update();
    this.context.renderer.render(this.context.scene, this.context.camera);
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
    this.windController.clear();
  }
}
