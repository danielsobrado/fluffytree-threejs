(() => {
  const container = document.querySelector('#app');
  if (!container) return;

  const fail = () => {
    if (container.childElementCount > 0) return;

    const message = 'Required application modules could not be loaded.';
    const element = document.createElement('div');
    element.className = 'demo-error';
    element.textContent = `The procedural tree demo could not start: ${message}`;
    container.replaceChildren(element);

    const query = new URLSearchParams({ status: 'error', error: message });
    void fetch(`/__render-smoke-status?${query}`, {
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  };

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLScriptElement && target.type === 'module') fail();
    },
    true,
  );
})();
