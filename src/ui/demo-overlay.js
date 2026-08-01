export function createDemoOverlay(container, presetLabels, releaseVersion) {
  const overlay = document.createElement('section');
  const title = document.createElement('h1');
  const description = document.createElement('p');

  overlay.className = 'demo-overlay';
  title.textContent = `Procedural fluffy trees — leaf detail · ${releaseVersion}`;
  description.textContent = `${presetLabels.join(' · ')}. Drag to orbit, scroll to zoom, press R to regenerate.`;
  overlay.append(title, description);
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
