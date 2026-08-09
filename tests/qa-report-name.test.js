import assert from 'node:assert/strict';
import test from 'node:test';
import { validateQaReportName } from '../src/qa/qa-report-name.js';

test('QA report names allow stable artifact identifiers', () => {
  assert.equal(validateQaReportName('canopy-solidity'), 'canopy-solidity');
  assert.equal(validateQaReportName('stress_720p'), 'stress_720p');
});

test('QA report names reject traversal and unsafe characters', () => {
  assert.throws(() => validateQaReportName('../report'));
  assert.throws(() => validateQaReportName('nested/report'));
  assert.throws(() => validateQaReportName('report.json'));
  assert.throws(() => validateQaReportName(''));
});
