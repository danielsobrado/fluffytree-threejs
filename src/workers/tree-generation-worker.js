import { TreeGenerator } from '../generation/tree-generator.js?v=2.0.0-20260814.2';
import { installTreeGenerationWorker } from './tree-generation-worker-runtime.js?v=2.0.0-20260814.2';

installTreeGenerationWorker(self, { treeGenerator: new TreeGenerator() });
