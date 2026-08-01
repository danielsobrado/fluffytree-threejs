# fluffytree-threejs

Procedural stylized trees built with Three.js.

**Live demo:** https://danielsobrado.github.io/fluffytree-threejs/

The repository is a deterministic, configuration-driven procedural tree system split into small generation, rendering, animation, diagnostics, and QA modules.

## Procedural structure

- Rounded orchard, columnar, and irregular vase-shaped crown families.
- Deterministic macro-clumps composed around a parented branch graph.
- Gnarled trunks, primary limbs, recursive forks, and exposed terminal twigs.
- Every foliage lobe records the branch that supports it.
- Faceted tapered tube geometry with branch-order taper and configurable flare.
- A terrain-embedded root collar overlaps the trunk tube.
- The collar is capped below terrain and deliberately open at the hidden trunk join, preventing a visible horizontal cut face.

## Painterly foliage and LOD

- Low-poly clump cores create the dark interior canopy mass.
- Alpha-cut procedural leaf sprays cover exposed surfaces and silhouettes.
- Sparse modeled hero leaves add close edge detail without filling the crown with geometry.
- Crown-aware palette shading produces coherent cavity, sky, height, and sunward color.
- Shader wind moves foliage without rotating the trunk or updating instance matrices on the CPU.
- Four projected-size levels retain the same generated silhouette from full geometry to a two-triangle impostor.
- Stable hysteresis prevents LOD boundary flapping.
- Complementary screen-door fades hide representation changes without transparent sorting.
- LOD0 is lazily prewarmed through a frame-budget queue; distant stress trees skip unused near data.
- Far impostors migrate into one instanced billboard draw per preset.
- A single low-detail clump proxy casts canopy shadows; leaf cards never duplicate the shadow cost.
- Current hero presets stay below 25,000 triangles at LOD0, 8,000 at LOD1, and 2,000 at LOD2.

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

For an explicit deployment of the already-pushed `main` commit without running QA, use:

```bash
npm run deploy:pages:no-qa
```

The no-QA command still fetches remote `main`, validates required Pages files, and updates `gh-pages` with force-with-lease; it only skips `npm run verify`.

## Verification

```bash
npm run check
npm run qa:render
npm run qa:shape
npm run qa:crown
npm run qa:lod
npm run qa:stress
npm run verify
```

Smaller development runs are available:

```bash
npm run qa:shape:quick
npm run qa:crown:quick
npm run qa:occupancy:quick
npm run qa:stress:render
```

The full control-shape run generates 2,048 seeded trees for each preset: 6,144 trees in total. Every tree is generated twice to verify exact replay determinism.

The crown-volume battery extracts 16 proxy meshes per preset and repeats each extraction.

The LOD budget gate measures every demo tree against fixed triangle, draw-call, and shadow-proxy limits.

The deterministic 75-tree stress gate projects a 1280×720 view, checks mixed-LOD migration, and enforces the 100-draw and 128 MB budgets. `qa:stress:render` additionally captures that scene in a browser; the 30 FPS requirement must be measured on the stated Iris Xe/GTX 670-class hardware rather than software WebGL.

The automated gates cover:

- Exact procedural topology and seed replay.
- Connected control volumes and front/side silhouettes.
- Crown aspect, density, envelope coverage, profile similarity, and spill.
- Branch insertion and monotonic trunk structure.
- Deterministic shadow-proxy extraction and seed uniqueness.
- A single closed proxy component with no boundary or non-manifold edges.
- No smooth crown mesh writing color or depth in the camera pass.
- Parented branch topology, monotonic taper, structurally anchored clumps, and exposed twigs.
- Surface-shell distribution and macro-clump silhouette quality.
- Descending triangle and draw-call budgets for all four LODs.
- A 75-tree 720p distribution with batched far impostors and bounded GPU resources.
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
