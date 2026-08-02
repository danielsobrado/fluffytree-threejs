const STATUS_ENDPOINT = '/__render-smoke-status';
const REPORT_ENDPOINT = '/__qa-report';

export function serializeQaError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function reportQaStatus(status, error = '') {
  const query = new URLSearchParams({ status, error });
  void fetch(`${STATUS_ENDPOINT}?${query}`, {
    cache: 'no-store',
    keepalive: true,
  }).catch(() => {});
}

export async function postQaReport(name, payload) {
  try {
    await fetch(`${REPORT_ENDPOINT}?${new URLSearchParams({ name })}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // The report file is a convenience artefact; the status call is the gate.
  }
}
