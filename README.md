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
- Trunks extend below the terrain and use a closed root cap so the base cannot appear cut open.

## Unified canopy

Control lobes define the crown but are no longer rendered as separate spheres.

- Rotated ellipsoid distance fields are combined with a smooth union.
- Marching tetrahedra extracts one continuous crown mesh.
- Low-frequency field displacement breaks the silhouette without producing spikes.
- Field-gradient normals remain smooth across former lobe boundaries.
- Broad crown-space palette patches replace per-card color noise.
- Opaque crown geometry avoids alpha overdraw and casts coherent shadows.

## Leaf detail

The unified crown is covered by deterministic instanced leaf rosettes:

- Surface samples are projected onto the final implicit crown rather than the hidden control lobes.
- Each cluster contains several folded leaf shapes growing mostly along the crown tangent.
- A small outward fold makes leaves readable without recreating the previous spike problem.
- Per-cluster colors stay coherent with the seasonal crown palette.
- One instanced draw call is used for each tree.
- Density, size, embedding, protrusion, color variation, and roughness are configured per preset.

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
npm run qa:crown
npm run verify
```

Smaller development runs are available:

```bash
npm run qa:shape:quick
npm run qa:crown:quick
```

The full control-shape run generates 2,048 seeded trees for each preset: 6,144 trees in total. Every tree is generated twice to verify exact replay determinism. Reports are written to `qa-results/tree-shape/report.json` and `report.md`.

The crown-volume battery extracts 16 unified meshes per preset and repeats each extraction. Its reports are written to `qa-results/crown-volume/report.json` and `report.md`.

The automated gates cover:

- Exact procedural topology and seed replay.
- Connected control volumes and front/side silhouettes.
- Crown aspect, density, envelope coverage, profile similarity, and spill.
- Branch insertion and monotonic trunk structure.
- Deterministic unified crown extraction and seed uniqueness.
- A single closed crown component with no boundary or non-manifold edges.
- Finite crown vertices, normalized field-gradient normals, coincident-normal consistency, and maximum surface edge length.
- Non-zero visible leaf-cluster and leaf counts in desktop and mobile WebGL renders.
- One capped, terrain-embedded root for every rendered crown.

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
