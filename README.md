# fluffytree-threejs

Procedural stylized trees built with Three.js.

**Live demo:** https://danielsobrado.github.io/fluffytree-threejs/

The repository is a deterministic, configuration-driven procedural tree system split into small generation, rendering, animation, diagnostics, and QA modules.

## Procedural structure

- Rounded orchard, columnar, irregular vase-shaped and bonsai pad crown families, plus ground bushes.
- Bushes and bonsai are presets, not separate systems: a short stem and a low wide crown, or a moving trunk and layered pads, through the same generator, renderer, LOD tiers and foliage gates.
- Seven trunk styles. `natural` is the historic shape; `formalUpright`, `informalUpright`, `slant`, `windswept`, `literati` and `semiCascade` are the bonsai families, each with its own taper, height distribution and movement.
- A trunk style is configuration, not code: `style`, `movement`, `curveCount`, `sweep`, `taperPower` and `nebari` tune any preset.
- Leaning styles anchor the crown on their own apex, so the canopy travels with the trunk instead of floating beside it.
- Every bonsai style holds its base vertical through a root ramp, so the swept tube's first ring stays level and buried whatever the trunk does higher up.
- Deterministic macro-clumps composed around a parented branch graph.
- Gnarled trunks, primary limbs, recursive forks, and exposed terminal twigs.
- Every foliage lobe records the branch that supports it.
- Faceted tapered tube geometry with branch-order taper and configurable flare.
- The trunk is one closed sweep: the root flare and its buttresses are a radius profile on the trunk tube itself, not a separate collar mesh, so there is no rim to see through.
- The sweep starts below the terrain and is capped at both ends; ring placement is biased towards the base so the flare stays smooth.

## Painterly foliage and LOD

- Low-poly clump cores create the dark interior canopy mass at every level of detail, including the hero level. An alpha-cut shell cannot tile a closed surface, so without the cores the sky shows through the crown.
- Five leaf silhouettes — broadleaf spray, palmate maple, juniper needles, ficus ovals and weeping willow — selected per preset with `foliage.leafShape`. A shape has to carry enough alpha per card to keep the canopy opaque, which is gated by a unit test and proved by the solidity gate.
- Alpha-cut procedural leaf sprays cover exposed surfaces and silhouettes. Clusters are chosen by deterministic maximal Poisson-disk selection over the whole crown, not per lobe, so every exposed patch is within a covering radius of a cluster that faces the same way. Selecting on score alone left whole lobes bare.
- Every lobe carries at least one cluster, so no lobe can render as bare core.
- Sparse modeled hero leaves add close edge detail without filling the crown with geometry.
- Crown-aware palette shading produces coherent cavity, sky, height, and sunward color.
- Shader wind moves the tree without updating instance matrices on the CPU. Cards, cores, hero leaves and wood share one sway function, and across the crown that sway is constant: the canopy is a rigid mass under wind, because a card lies tangent to its lobe and any relative motion buries it behind the core it covers. The wood ramps into the same travel from a planted base, and the solidity gate measures that the canopy actually moves between two wind phases.
- Four projected-size levels retain the same generated silhouette from full geometry to a two-triangle impostor.
- Stable hysteresis prevents LOD boundary flapping.
- Complementary screen-door fades hide representation changes without transparent sorting.
- LOD0 is lazily prewarmed through a frame-budget queue; distant stress trees skip unused near data.
- Far impostors migrate into one instanced billboard draw per preset.
- A single low-detail clump proxy casts canopy shadows; leaf cards never duplicate the shadow cost.
- Current hero presets stay below 25,000 triangles at LOD0, 8,000 at LOD1, and 2,000 at LOD2.
- Snow is a coverage rather than a tint: it mixes over what faces the sky instead of shading it, so a laden crown is white on top whatever colour it was underneath, and it keeps the sky term so snow in a crown's cavity stays in shade. `snowSharpness` is the difference between a laden crown and a dusted one. `gladeFrost` and `gladeRust` ship it; every preset written before it is untouched, because the strength defaults to zero.

## The frame

The scene is graded as a diorama rather than as a landscape, which is mostly the lens.

- Depth of field over the scene's own depth buffer, ahead of the bloom. One band around whatever is being looked at stays sharp, the foreground melts fast and the tree line melts slowly. It reads the depth the scene pass already wrote rather than drawing the scene a second time the way three.js's `BokehPass` does, and pixels inside the sharp band take none of its sixteen taps.
- Focus follows the orbit target, so pulling the camera back deepens the melt instead of defocusing the subject. Walking, it rests a fixed distance ahead.
- A pool of ambient shade under every crown, all of them in one instanced multiply-blended draw. Not the sun's shadow, which the shadow map draws from wherever the sun stands: this is the sky being occluded, and without it a tree reads as hovering over the meadow.
- A carpet of grass tufts and flower sprigs — crossed quads, one instanced draw, coloured from a shared meadow palette, bending on the same wind the crowns do and freezing with them under `?wind=off`.
- Light pooling baked into the ground's own vertex colours: broad patches, several metres across, where the meadow is a shade paler and warmer. Costs one attribute and nothing per frame.
- The whole chain is off under `?qa=`, because every gate that reads pixels was calibrated against the ungraded image. `?post=on` forces it back for a capture.

## Run locally

```bash
npm ci
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Tree studio

The demo carries a side panel for tuning presets live. It starts collapsed, so
the page looks exactly as it does without it, and it is hidden entirely whenever
the page is opened with a `qa` parameter, so it never appears in a measured
capture.

- Trunk, branch, crown, leaf and canopy-shading controls are generated from
  `src/ui/tuning-schema.js`. Individual control ranges stay inside validator
  ranges; invalid cross-field combinations are rejected and rolled back before
  the rendered tree is replaced.
- Opening the studio switches the scene to one tree of the edited preset;
  closing it puts the whole scene back. Generating the full layout takes seconds
  while one tree takes a few hundred milliseconds, which is what makes a slider
  usable. Clear **Solo** to edit against the whole scene instead.
- The **coverage** readout uses the same evaluator and per-preset thresholds as
  `npm run qa:coverage`, including candidate, physical and continuous coverage,
  worst gap in card widths, leaf area per exposed crown area, and bare lobes.
- **Close the gaps** solves for leaf packing inside the configured per-preset
  coverage limits and regenerates until the shared coverage evaluator passes or
  no tighter useful packing remains.
- Settings are saved by name in `localStorage` and export as a YAML file shaped
  like `config/tree-presets.yaml`, so a tuned tree can be pasted straight back
  into the preset configuration.

Changing the trunk style adopts that style's taper, because taper is part of
what a style is rather than an independent number.

## Forest glade

A **Scene** menu in the corner of the demo switches the hand-placed garden for a
walkable forest, which is where the level-of-detail system is actually put to
work: hundreds of trees, all four levels live at once, and a camera that can
stand underneath the canopy instead of orbiting outside it.

- Three sizes — small glade, woodland and deep forest — of roughly 150, 260 and
  400 trees. Each is a deterministic jittered grid thinned by distance, so the
  clearing stays open, the tree line around it reads as a wall, and the rim
  fades out rather than ending on a circle. **New forest** lays the same size
  out again from a different seed.
- Presets are planted by height: the tall crowns form the canopy, the bonsai
  families fill the understory, and the bushes cover the ground and the meadow.
  Every tree carries a size variation, because a seed changes a tree's shape but
  not how tall it grew.
- **Orbit**, **Walk** and **Fly**. Walking is pinned to eye height and stopped by
  trunks; flying goes where the view points. WASD or the arrow keys move, Shift
  runs, Space and C change height in the air, and clicking the view captures the
  mouse for looking around — Esc gives it back.
- Trees past the point anyone is likely to walk to never build their near levels
  and never generate the surface samples those levels need, which is most of a
  large forest.
- One shadow map cannot cover a forest, so the sun follows the viewer, anchored
  to a grid so the map is rebuilt in steps rather than every frame.
- The readout under the menu reports frames, draw calls, triangles, buffers and
  the level-of-detail distribution. The distribution is the number that matters:
  a forest that runs well because everything in it is an impostor has not proved
  anything.
- The forest grows through the same frame-budget queue as the stress scene,
  nearest tree first, so the clearing you are standing in fills before the rim.

The scene can be opened directly with `?scene=forest`, sized with
`?forest=glade|woodland|deepForest`, and entered walking or flying with
`?camera=walk|fly`.

### Freezing the wind

`?wind=off` holds every crown at the pose it was generated in. A moving canopy
never renders the same image twice, so any before-and-after comparison of a
shader, a preset or a culling change measures the wind instead of the change:
two runs of the render smoke differ in about 17% of their pixels with the wind
on, and in none at all with it off. The frozen pose is also the one the
impostors and the shadow proxies are baked from, so a still scene is the
self-consistent one to measure. The render QA passes it through with
`RENDER_SMOKE_QUERY="wind=off"`.

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

`npm run check` syntax-checks JavaScript, verifies local module and HTML entry assets, validates runtime/QA YAML and Pages/release coherence, then runs the unit tests.

```bash
npm run check
npm run qa:manifold
npm run qa:render
npm run qa:solidity
npm run qa:coverage
npm run qa:shape
npm run qa:crown
npm run qa:lod
npm run qa:stress
npm run qa:stress:render
npm run verify
```

Smaller development runs are available:

```bash
npm run qa:shape:quick
npm run qa:crown:quick
```

The full control-shape run generates 2,048 seeded trees for every configured preset. Every tree is generated twice to verify exact replay determinism.

The crown-volume battery extracts 16 proxy meshes per preset and repeats each extraction.

The LOD budget gate measures every demo tree against triangle, draw-call, and shadow-proxy limits from `config/tree-lod-qa.yaml`.

The deterministic 75-tree stress gate projects a 1280×720 view, checks mixed-LOD migration, and enforces budgets from `config/tree-stress-qa.yaml`. `qa:stress:render` additionally captures that scene in a browser; the configured FPS target must be measured on target hardware rather than software WebGL.

The leaf coverage gate measures how far the exposed crown surface ever gets from a leaf cluster that could cover it. Probes are an independent Fibonacci set, twice as dense as the candidates the generator chose from and offset by an unrelated phase, and a cluster only counts when it faces the same way as the probe. The worst gap is reported in card widths, so a pass means the cards always overlap. It runs over a seed sweep rather than only the demo seeds, because cluster counts follow from covering the surface and vary with the seed. Limits live in `config/shell-coverage-qa.yaml`.

The LOD budget gate measures the demo layout plus its configured seed sweep, for the same reason.

The canopy solidity gate renders every demo tree alone against a transparent background. Crown views measure LOD0, LOD1, LOD2, LOD3 and all three complementary transition midpoints from eight angles; trunk views measure LOD0 with foliage hidden from three angles. Background pixels that cannot reach the image border are counted as see-through openings. Transition renders keep the same high-resolution frame for strict coverage comparison, while minimum visible-hole size is scaled to the projected-pixel threshold where that transition actually runs in `config/scene.yaml`. This keeps the gate sensitive to gaps that are visible in production without magnifying a 35-pixel far tree into a false failure. Limits live in `config/canopy-solidity-qa.yaml`, and a failing run writes the worst view of each preset to `qa-results/canopy-solidity/` with every counted opening flooded in magenta.

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
- A watertight trunk sweep with no boundary or non-manifold edges, capped below the terrain.
- No see-through openings in the rendered crown or trunk from any measured angle.
- No exposed crown surface farther from a compatible leaf cluster than a leaf card is wide.
- Leaf area per unit of exposed crown surface within range, so one preset cannot read as noticeably thinner foliage than another.
- Shader wind visibly displaces the canopy.
- The exact uploaded release identifier in the browser and visible demo titles.

## Structure

```text
config/                 Runtime and QA YAML configuration
qa/baselines/           Accepted deterministic numeric reports
src/app/                Application orchestration and scene layouts
src/animation/          Runtime animation controllers
src/config/             Configuration loading
src/controls/           Walk and fly camera navigation
src/core/               Cross-cutting utilities
src/diagnostics/        Browser and rendering diagnostics
src/domain/             Validated domain configuration
src/generation/         Renderer-independent procedural generation, including trunk styles
src/qa/                 Numeric topology, silhouette, shell, and screen-space solidity analysis
src/rendering/          Three.js geometry, material, and mesh construction
src/ui/                 DOM presentation, the tree studio and the scene menu
styles/                 Page styling
tests/                  Deterministic generation, rendering-data, and QA tests
tools/                  Command-line QA and deployment entry points
```

## Attribution

Original project by Leonardo Soares Gonçalves. See `LICENSE` for the MIT license.
