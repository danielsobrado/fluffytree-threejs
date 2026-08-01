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
- Numeric shape gates across thousands of deterministic trees.

The fuzzy outer foliage shell, lobe-aware stylized shading, seasonal palette textures, and production LOD system belong to later phases.

## Run locally

Install the QA dependency, then serve the repository through an HTTP server. Opening `index.html` directly with a `file://` URL will not work because browsers block YAML fetches.

```bash
npm ci
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy to GitHub Pages

GitHub Pages publishes the repository root from the `gh-pages` branch. After changes are committed and pushed to `main`, run:

```bash
npm ci
npm run deploy:pages
```

The command runs the standard checks, fetches the remote `main` branch, verifies the required static-site files, and updates `gh-pages` using force-with-lease. Deployment settings are stored in `pages.config.yml`.

Configure the repository Pages source as **Deploy from a branch**, using `gh-pages` and `/(root)`.

## Tests

```bash
npm test
```

## Deterministic shape QA

The expensive QA run generates 2,048 seeded trees for each preset: 6,144 trees in total. Every tree is generated twice to verify exact replay determinism.

```bash
npm run qa:shape
```

A smaller local run is available while changing the generator:

```bash
npm run qa:shape:quick
```

Reports are written to `qa-results/tree-shape/report.json` and `report.md`. The accepted Phase 1 baseline is stored in `qa/baselines/`.

The QA gates measure:

- Exact foliage-lobe, branch, and trunk-point counts.
- Finite numeric output and seed uniqueness.
- Connected 3D foliage and connected front/side silhouettes.
- Crown height-to-width and width-to-depth ratios.
- Foliage density inside the silhouette bounding box.
- Coverage of the configured crown envelope and foliage spill outside it.
- Similarity between the generated silhouette and the requested round, columnar, or vase profile.
- Empty silhouette holes and disconnected foliage islands.
- Lobe distribution across lower, middle, and upper crown bands.
- Trunk penetration into the crown.
- Branch endpoints embedded inside their target foliage lobes.

The baseline run passes all gates with zero failed trees, zero deterministic mismatches, and 100% unique tree hashes for every preset.

## Structure

```text
config/                 Runtime and QA YAML configuration
qa/baselines/           Accepted deterministic numeric reports
src/app/                Application orchestration
src/animation/          Runtime animation controllers
src/config/             Configuration loading
src/core/               Cross-cutting utilities
src/domain/             Validated domain configuration
src/generation/         Renderer-independent procedural generation
src/qa/                 Numeric topology, silhouette, and volume analysis
src/rendering/          Three.js scene and mesh construction
src/ui/                 DOM presentation
styles/                 Page styling
tests/                  Deterministic generation and QA tests
tools/                  Command-line QA and deployment entry points
```

## Attribution

Original project by Leonardo Soares Gonçalves. See `LICENSE` for the MIT license.
