import { logger } from '../core/logger.js';
import { adaptValidatedTreeIrToLegacyTreeData } from '../generation/tree-ir-legacy-adapter.js';
import { TreeDemo } from './tree-demo.js';

const RESEED_STEP = 1009;

function resolveQueuedSeed(entrySeed, seedOffset) {
  return (Number(entrySeed) + Math.imul(seedOffset, RESEED_STEP)) >>> 0;
}

function isCancellation(error) {
  return error?.name === 'AbortError';
}

export class WorkerTreeDemo extends TreeDemo {
  constructor({
    workerTreeGenerationService = null,
    treeIrAdapter = adaptValidatedTreeIrToLegacyTreeData,
    ...options
  } = {}) {
    super(options);
    if (
      workerTreeGenerationService &&
      typeof workerTreeGenerationService.generate !== 'function'
    ) {
      throw new TypeError('WorkerTreeDemo requires a worker generation service.');
    }
    if (workerTreeGenerationService && typeof this.treeGenerator.prime !== 'function') {
      throw new TypeError('WorkerTreeDemo requires a primeable tree generator cache.');
    }
    if (typeof treeIrAdapter !== 'function') {
      throw new TypeError('WorkerTreeDemo requires a Tree IR adapter.');
    }

    this.workerTreeGenerationService = workerTreeGenerationService;
    this.treeIrAdapter = treeIrAdapter;
    this.workerBuildRevision = 0;
    this.pendingWorkerBuilds = 0;
    this.workerServiceDestroyed = false;
  }

  isCurrentWorkerBuild(revision) {
    return !this.destroyed && revision === this.workerBuildRevision;
  }

  rebuildTrees() {
    this.workerBuildRevision += 1;
    this.pendingWorkerBuilds = 0;
    this.workerTreeGenerationService?.cancelAll?.();
    super.rebuildTrees();
  }

  rebuildQueuedTrees() {
    if (!this.workerTreeGenerationService) {
      super.rebuildQueuedTrees();
      return;
    }

    this.clearLiveTrees();
    const entries = [...this.activeLayout];
    this.contactShadows?.reset(entries.length);
    this.registerMeadowWind();

    const revision = this.workerBuildRevision;
    const seedOffset = this.seedOffset;
    this.pendingWorkerBuilds = entries.length;

    entries.forEach((entry, index) => {
      void this.generateQueuedTree(entry, index, entries.length, revision, seedOffset);
    });
  }

  installGeneratedTree(
    treeIr,
    preset,
    entry,
    revision,
    seed,
    generationOptions,
    minimumLod,
  ) {
    if (!this.isCurrentWorkerBuild(revision)) return;

    const treeData = this.treeIrAdapter(treeIr);
    this.treeGenerator.prime(preset, seed, generationOptions, treeData);
    if (!this.isCurrentWorkerBuild(revision)) return;

    const built = this.buildTreeEntry(entry, this.billboardBatchManager);
    this.context.scene.add(built.root);
    this.treeRoots.push(built.root);
    if (minimumLod === 0) this.treeDataByPreset.set(entry.preset, built.treeData);
    this.lodController.register(built.root);
    this.windController.register(built.root, built.treeData.seed);
    this.dressTree(built.root);
    this.context.renderer.shadowMap.needsUpdate = true;
  }

  async generateQueuedTree(entry, index, treeCount, revision, seedOffset) {
    try {
      const preset = this.presetMap.get(entry.preset);
      if (!preset) {
        throw new Error(`Layout references unknown tree preset '${entry.preset}'.`);
      }

      const minimumLod = this.resolveMinimumLod(entry);
      const seed = resolveQueuedSeed(entry.seed, seedOffset);
      const generationOptions = Object.freeze({
        includeSurfaceSamples: minimumLod < 2,
      });
      const treeIr = await this.workerTreeGenerationService.generate(preset, seed, {
        generationOptions,
        priority: treeCount - index,
      });

      if (!this.isCurrentWorkerBuild(revision)) return;

      this.generationQueue.enqueue(`tree:${revision}:${index}`, () =>
        this.installGeneratedTree(
          treeIr,
          preset,
          entry,
          revision,
          seed,
          generationOptions,
          minimumLod,
        ),
      );
    } catch (error) {
      if (!this.isCurrentWorkerBuild(revision) || isCancellation(error)) return;

      logger.error('Background tree generation failed.', {
        presetId: entry.preset,
        index,
        error,
      });
      this.handleRuntimeError(error);
    } finally {
      if (revision === this.workerBuildRevision) {
        this.pendingWorkerBuilds = Math.max(0, this.pendingWorkerBuilds - 1);
      }
    }
  }

  createStatisticsSample() {
    const sample = super.createStatisticsSample();
    return {
      ...sample,
      pending: sample.pending + this.pendingWorkerBuilds,
      workerGeneration: this.workerTreeGenerationService?.metrics?.worker ?? null,
    };
  }

  async runCanopySolidityProbe() {
    if (!this.canopySolidityProbe.enabled) return;

    do {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (this.destroyed || !this.context) return;
    } while (this.pendingWorkerBuilds > 0 || this.generationQueue.length > 0);

    await this.canopySolidityProbe.run({
      renderer: this.context.renderer,
      scene: this.context.scene,
      trees: this.treeRoots,
    });
  }

  destroy() {
    this.workerBuildRevision += 1;
    this.pendingWorkerBuilds = 0;

    if (!this.workerServiceDestroyed) {
      this.workerServiceDestroyed = true;
      this.workerTreeGenerationService?.destroy?.();
    }

    if (!this.destroyed) super.destroy();
  }
}
