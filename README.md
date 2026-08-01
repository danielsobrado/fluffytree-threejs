# fluffytree-threejs

Procedural stylized trees built with Three.js.

**Live demo:** https://danielsobrado.github.io/fluffytree-threejs/

The repository is a deterministic, configuration-driven procedural tree system split into small generation, rendering, animation, diagnostics, and QA modules.

## Phase 1: procedural structure

- Rounded orchard, columnar, and irregular vase-shaped crown envelopes.
- Deterministic foliage-lobe placement from a seed.
- Generated bent trunks and primary branches.
- Connected crown enforcement and branch-to-foliage insertion.

## Phase 2: stylized foliage

- Opaque instanced crown cores.
- Deterministic exposed foliage shells.
- Seasonal palette textures and stylized canopy lighting.
- Low-detail crown shadow proxies.
- Headless WebGL shader compilation and screenshot smoke testing.

## Phase 2.5: visual parity

The visual-parity pass addresses the main issues visible in Phase 2 mobile captures:

- More consistent overlapping lobes reduce isolated ball-shaped crown masses.
- Crown-wide normals blend lighting across neighbouring lobes.
- Radial root-anchored foliage fins replace tangent cards that looked like surface craters.
- Shell colors inherit from their source lobe with limited variation.
- Shell cavity darkening is reduced so exterior foliage remains readable.
- Higher-detail, less-deformed crown cores reduce obvious icosahedron facets.

Current deterministic budgets:

| Preset | Core lobes | Shell clusters | Leaf cards |
|---|---:|---:|---:|
| Round orchard | 16 | 384 | 1,152 |
| Columnar | 18 | 414 | 1,242 |
| Irregular autumn | 17 | 442 | 1,326 |

Hierarchical wind and production distance LOD remain later phases.

## Run locally

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

The command runs all release checks, fetches remote `main`, verifies the required static-site files, and updates `gh-pages` using force-with-lease. Deployment settings are stored in `pages.config.yml`.

## Verification

```bash
npm run check
npm run qa:render
npm run qa:shape
npm run verify
```

A smaller local shape run is available while changing the generator:

```bash
npm run qa:shape:quick
```

The full shape run generates 2,048 seeded trees for each preset: 6,144 trees in total. Every tree is generated twice to verify exact replay determinism. Reports are written to `qa-results/tree-shape/report.json` and `report.md`.

The QA gates measure:

- Exact lobe, shell-cluster, leaf-card, branch, and trunk-point counts.
- Finite numeric output, deterministic replay, and seed uniqueness.
- Connected 3D foliage and connected front/side silhouettes.
- Crown aspect, density, envelope coverage, profile similarity, and foliage spill.
- Shell surface attachment, normals, scale, exposure, and silhouette contribution.
- Trunk penetration and branch endpoints embedded inside target lobes.

## Structure

```text
config/                 Runtime and QA YAML configuration
qa/baselines/           Accepted deterministic numeric reports
src/app/                Application orchestration
src/animation/          Runtime animation controllers
src/config/             Configuration loading
src/core/               Cross-cutting utilities
src/diagnostics/        Browser and rendering diagnostics
src/domain/             Validated domain configuration
src/generation/         Renderer-independent procedural generation
src/qa/                 Numeric topology, silhouette, shell, and volume analysis
src/rendering/          Three.js geometry, material, texture, and mesh construction
src/ui/                 DOM presentation
styles/                 Page styling
tests/                  Deterministic generation, shader, and QA tests
tools/                  Command-line QA and deployment entry points
```

## Attribution

Original project by Leonardo Soares Gonçalves. See `LICENSE` for the MIT license.
