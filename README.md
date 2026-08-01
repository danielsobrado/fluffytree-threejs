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
- A terrain-embedded root collar overlaps the trunk tube.
- The collar is capped below terrain and deliberately open at the hidden trunk join, preventing a visible horizontal cut face.

## Volumetric leaf canopy

Control lobes and the smooth implicit crown remain generation tools. They are not rendered as visible foliage.

- Four surface layers provide the visible silhouette.
- Volume samples fill the full interior cross-section of every active foliage lobe.
- A dedicated trunk-occlusion column hides the central trunk from ordinary camera angles.
- Saddle samples fill negative space between neighboring crown masses.
- Layered top-cap samples close crown tips.
- Interior samples use multiple micro-layers with deterministic 3D jitter so they form depth rather than another hollow shell.
- The implicit crown mesh remains color- and depth-disabled and is used only as a coherent shadow proxy.
- Small irregular golden-angle leaf tufts provide all visible foliage.
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
npm run qa:occupancy
npm run verify
```

Smaller development runs are available:

```bash
npm run qa:shape:quick
npm run qa:crown:quick
npm run qa:occupancy:quick
```

The full control-shape run generates 2,048 seeded trees for each preset: 6,144 trees in total. Every tree is generated twice to verify exact replay determinism.

The crown-volume battery extracts 16 proxy meshes per preset and repeats each extraction.

The canopy occupancy battery generates 256 seeds per preset and measures interior coverage, minimum horizontal-slice coverage, trunk occlusion, top-cap coverage, and exact replay. Reports are written to `qa-results/canopy-occupancy/report.json` and `report.md`.

The automated gates cover:

- Exact procedural topology and seed replay.
- Connected control volumes and front/side silhouettes.
- Crown aspect, density, envelope coverage, profile similarity, and spill.
- Branch insertion and monotonic trunk structure.
- Deterministic shadow-proxy extraction and seed uniqueness.
- A single closed proxy component with no boundary or non-manifold edges.
- No smooth crown mesh writing color or depth in the camera pass.
- Minimum surface-shell density and four radial surface layers.
- Minimum volume, trunk, saddle, and top-cap occupancy for every tree.
- Multi-seed numeric coverage thresholds for crown slices, trunk occlusion, and cap closure.
- A terrain-embedded root collar with positive trunk overlap and no visible top cap.
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
src/qa/                 Numeric topology, silhouette, shell, and occupancy analysis
src/rendering/          Three.js geometry, material, and mesh construction
src/ui/                 DOM presentation
styles/                 Page styling
tests/                  Deterministic generation, rendering-data, and QA tests
tools/                  Command-line QA and deployment entry points
```

## Attribution

Original project by Leonardo Soares Gonçalves. See `LICENSE` for the MIT license.
