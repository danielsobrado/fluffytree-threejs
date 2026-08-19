import { TreeGenerator } from '../generation/tree-generator.js';
import { installTreeGenerationWorker } from './tree-generation-worker-runtime.js';

installTreeGenerationWorker(self, { treeGenerator: new TreeGenerator() });
