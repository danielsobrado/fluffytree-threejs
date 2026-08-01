# fluffytree-threejs

Procedural stylized trees built with Three.js.

**Live demo:** https://danielsobrado.github.io/fluffytree-threejs/

The repository is a deterministic, configuration-driven procedural tree system split into small generation, rendering, animation, diagnostics, and QA modules.

## Procedural structure

- Rounded orchard, columnar, and irregular vase-shaped crown envelopes.
- Deterministic control-lobe placement from a seed.
- Generated curved trunks and primary supporting branches.
- Connected crown enforcement and branch-to-crown insertion.
- Seamless tapered tube geometry with configurable trunk flare.
- A capped root collar extends below the terrain and overlaps the trunk tube.
- Seeded buttresses broaden the trunk naturally without exposing a cut seam.

## Leaf-only canopy

Control lobes and the smooth implicit crown remain generation tools. They are not rendered as visible foliage.

- The implicit crown mesh is color- and depth-disabled in the camera pass.
- It remains available only as a slightly inset coherent shadow proxy.
- Small dense instanced leaf tufts form the complete visible canopy.
- Four radial layers extend from inside the crown to its silhouette.
- Deterministic tangential jitter breaks rings and closes gaps between control regions.
- Irregular golden-angle tufts avoid repeated flower-like rosettes.
- Per-cluster colors remain coherent with each seasonal palette.

Hierarchical wind and production distance LOD remain later phases.

## Run locally

```bash
npm ci
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy to GitHub Pages

GitHub Pages publishes the repository root from the `gh-pages` branch. Before each upload, increment the release identifier in `config/release.yaml`. The exact identifier is rendered in both the browser title and the visible demo title so stale deployments are immediately obvious.

After changes are committed and pushed to `main`, run:

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
npm run qa:crown
npm run verify
```

Smaller development runs are available:

```bash
npm run qa:shape:quick
npm run qa:crown:quick
```

The full control-shape run generates 2,048 seeded trees for each preset: 6,144 trees in total. Every tree is generated twice to verify exact replay determinism. Reports are written to `qa-results/tree-shape/report.json` and `report.md`.

The crown-volume battery extracts 16 proxy meshes per preset and repeats each extraction. Its reports are written to `qa-results/crown-volume/report.json` and `report.md`.

The automated gates cover:

- Exact procedural topology and seed replay.
- Connected control volumes and front/side silhouettes.
- Crown aspect, density, envelope coverage, profile similarity, and spill.
- Branch insertion and monotonic trunk structure.
- Deterministic shadow-proxy extraction and seed uniqueness.
- A single closed proxy component with no boundary or non-manifold edges.
- Finite proxy vertices, normalized field-gradient normals, coincident-normal consistency, and maximum surface edge length.
- No smooth crown mesh writing color or depth in the camera pass.
- A minimum four-layer leaf density for every rendered tree.
- A capped, terrain-embedded root collar with positive trunk overlap.
- The exact uploaded release identifier in the browser and visible demo titles.

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
src/rendering/          Three.js geometry, material, and mesh construction
src/ui/                 DOM presentation
styles/                 Page styling
tests/                  Deterministic generation, rendering-data, and QA tests
tools/                  Command-line QA and deployment entry points
```

## Attribution

Original project by Leonardo Soares Gonçalves. See `LICENSE` for the MIT license.
