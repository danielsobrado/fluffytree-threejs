# fluffytree-threejs

Procedural stylized trees built with Three.js.

**Live demo:** https://danielsobrado.github.io/fluffytree-threejs/

The repository started as a shader-enhanced authored scene. It is now a deterministic, configuration-driven procedural tree system split into small generation, rendering, animation, diagnostics, and QA modules.

## Phase 1: procedural structure

- Rounded orchard, columnar, and irregular vase-shaped crown envelopes.
- Deterministic foliage-lobe placement from a seed.
- Generated bent trunks and primary branches.
- Connected crown enforcement and branch-to-foliage insertion.

## Phase 2: stylized foliage

- Opaque instanced crown cores that keep the canopy visually solid.
- Deterministic exposed foliage shells generated around every crown lobe.
- Alpha-tested crossed-plane shell clusters without transparent volume overdraw.
- Lobe-aware radial normals instead of camera-facing foliage normals.
- Wrapped sunlight, sky contribution, height lighting, and cavity darkening.
- Configurable four-stop seasonal palette textures.
- Low-detail invisible crown proxies for stable, inexpensive cast shadows.
- Headless WebGL shader compilation and screenshot smoke testing.

Current shell budgets are intentionally explicit:

| Preset | Shell clusters | Leaf cards |
|---|---:|---:|
| Round orchard | 198 | 594 |
| Columnar | 221 | 663 |
| Irregular autumn | 240 | 720 |

A production distance LOD and impostor system is not part of Phase 2.

## Run locally

Install the QA dependency, then serve the repository through an HTTP server. Opening `index.html` directly with a `file://` URL will not work because browsers block YAML fetches.

```bash
npm ci
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Verification

Run source checks and unit tests:

```bash
npm run check
```

Compile and render the actual foliage shaders in headless Chrome:

```bash
npm run qa:render
```

Run the expensive deterministic shape and foliage QA:

```bash
npm run qa:shape
```

Run every release gate:

```bash
npm run verify
```

A smaller local shape run is available while changing the generator:

```bash
npm run qa:shape:quick
```

The full shape run generates 2,048 seeded trees for each preset: 6,144 trees in total. Every tree is generated twice to verify exact replay determinism. Reports are written to `qa-results/tree-shape/report.json` and `report.md`. Accepted Phase 1 and Phase 2 baselines are stored in `qa/baselines/`.

The QA gates measure:

- Exact lobe, shell-cluster, leaf-card, branch, and trunk-point counts.
- Finite numeric output, deterministic replay, and seed uniqueness.
- Connected 3D foliage and connected front/side silhouettes.
- Crown height-to-width and width-to-depth ratios.
- Crown-envelope coverage, profile similarity, and foliage spill.
- Empty silhouette holes and disconnected foliage islands.
- Shell surface attachment, normal length, outward alignment, scale, and exposure.
- Hidden-shell ratio and measurable shell silhouette contribution.
- Lobe distribution across lower, middle, and upper crown bands.
- Trunk penetration and branch endpoints embedded inside target lobes.

The accepted Phase 2 baseline passes all gates with zero failed trees, zero deterministic mismatches, and 100% unique hashes for every preset.

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
src/rendering/          Three.js scene, geometry, material, texture, and mesh construction
src/ui/                 DOM presentation
styles/                 Page styling
tests/                  Deterministic generation, shader, and QA tests
tools/                  Command-line and browser QA entry points
```

## Attribution

Original project by Leonardo Soares Gonçalves. See `LICENSE` for the MIT license.
