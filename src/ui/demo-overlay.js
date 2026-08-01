export function createDemoOverlay(container, presetLabels) {
  const overlay = document.createElement('section');
  overlay.className = 'demo-overlay';
  overlay.innerHTML = `
    <h1>Procedural fluffy trees — Phase 2</h1>
    <p>${presetLabels.join(' · ')}. Drag to orbit, scroll to zoom, press R to regenerate.</p>
  `;
  container.appendChild(overlay);
  return overlay;
}

export function showFatalError(container, error) {
  const message = error instanceof Error ? error.message : String(error);
  const element = document.createElement('div');
  element.className = 'demo-error';
  element.textContent = `The procedural tree demo could not start: ${message}`;
  container.replaceChildren(element);
}
