process.env.RENDER_SMOKE_QA_MODE = 'manifold';
process.env.RENDER_SMOKE_OUTPUT ??= 'qa-results/stem-manifold';
await import('./run-render-smoke.js');
