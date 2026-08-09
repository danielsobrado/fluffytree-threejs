const QA_REPORT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function validateQaReportName(value) {
  if (typeof value !== 'string' || !QA_REPORT_NAME_PATTERN.test(value)) {
    throw new Error(`Invalid QA report name '${String(value)}'.`);
  }
  return value;
}
