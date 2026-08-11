const STATUS_ENDPOINT = '/__render-smoke-status';
const REPORT_ENDPOINT = '/__qa-report';

function isQaMode() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').has('qa');
  } catch {
    return false;
  }
}

export function serializeQaError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function reportQaStatus(status, error = '') {
  if (!isQaMode()) return;

  const query = new URLSearchParams({ status, error });
  void fetch(`${STATUS_ENDPOINT}?${query}`, {
    cache: 'no-store',
    keepalive: true,
  }).catch(() => {});
}

export async function postQaReport(name, payload) {
  if (!isQaMode()) return;

  const response = await fetch(
    `${REPORT_ENDPOINT}?${new URLSearchParams({ name })}`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to store QA report '${name}': ${response.status} ${response.statusText ?? ''}`.trim(),
    );
  }
}
