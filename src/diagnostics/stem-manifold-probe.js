import { StemManifoldQaRunner } from '../qa/stem-manifold-qa-runner.js';
import {
  postQaReport,
  reportQaStatus,
  serializeQaError,
} from './qa-status-reporter.js';

const QUERY_VALUE = 'manifold';
const STATUS_ATTRIBUTE = 'manifoldStatus';
const ERROR_ATTRIBUTE = 'manifoldError';

function isRequested() {
  return new URLSearchParams(window.location.search).get('qa') === QUERY_VALUE;
}

export class StemManifoldProbe {
  constructor({
    root = document.documentElement,
    runner = new StemManifoldQaRunner(),
  } = {}) {
    this.root = root;
    this.runner = runner;
    this.enabled = isRequested();
  }

  async run(presets, configuration) {
    if (!this.enabled) return null;
    this.root.dataset[STATUS_ATTRIBUTE] = 'pending';

    try {
      const report = this.runner.run(presets, configuration);
      await postQaReport('stem-manifold', report);

      if (!report.passed) {
        throw new Error(
          `${report.summary.failedGeometryCount} of ${report.summary.geometriesAnalyzed} generated stems failed manifold validation.`,
        );
      }

      this.root.dataset[STATUS_ATTRIBUTE] = 'ready';
      this.root.dataset.manifoldGeometryCount = String(
        report.summary.geometriesAnalyzed,
      );
      reportQaStatus('ready');
      return report;
    } catch (error) {
      markStemManifoldBootstrapFailure(error, this.root);
      throw error;
    }
  }
}

export function markStemManifoldBootstrapFailure(
  error,
  root = document.documentElement,
) {
  if (!isRequested()) return;
  const message = serializeQaError(error);
  root.dataset[STATUS_ATTRIBUTE] = 'error';
  root.dataset[ERROR_ATTRIBUTE] = message;
  reportQaStatus('error', message);
  console.error('Stem manifold QA failed.', error);
}
