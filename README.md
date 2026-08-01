# fluffytree-threejs

Procedural stylized trees built with Three.js.

**Live demo:** https://danielsobrado.github.io/fluffytree-threejs/

The repository started as a shader-enhanced authored scene. It is now organized as a small procedural tree system with deterministic generation and configuration-driven presets.

## Phase 1

Phase 1 provides:

- Rounded orchard, columnar, and irregular vase-shaped crown envelopes.
- Deterministic foliage-lobe placement from a seed.
- Generated bent trunks and primary branches.
- Instanced opaque foliage cores.
- Shared scene, renderer, generation, rendering, animation, and UI modules.
- YAML scene and tree-preset configuration.
- Unit tests for crown profiles and deterministic generation.

The fuzzy outer foliage shell, lobe-aware stylized shading, seasonal palette textures, and production LOD system belong to later phases.

## Run locally

Serve the repository through any static HTTP server. Opening `index.html` directly with a `file://` URL will not work because browsers block YAML fetches.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Tests

```bash
npm test
```

## Structure

```text
config/                 Runtime YAML configuration
src/app/                Application orchestration
src/animation/          Runtime animation controllers
src/config/             Configuration loading
src/core/               Cross-cutting utilities
src/domain/             Validated domain configuration
src/generation/         Renderer-independent procedural generation
src/rendering/          Three.js scene and mesh construction
src/ui/                 DOM presentation
styles/                 Page styling
tests/                  Deterministic generation tests
```

## Attribution

Original project by Leonardo Soares Gonçalves. See `LICENSE` for the MIT license.
