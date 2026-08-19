# Performance plan — exact work items

> **Status, after implementation.** Items §2, §3 and §6 shipped as written. §1 shipped
> in a different and better form than planned — see the measured note below and
> `research-leaf-placement-and-culling.md` §2.4. §4 and §5 are open.
>
> Measured, whole-tree generation, min-of-7 per preset, one tree of each of the
> original eight presets: **2472 ms → 889 ms (2.8×)**, with shell instance counts
> identical seed for seed. The three new glade presets generate in roughly half the
> time of their nearest equivalents (`gladeCanopy` 27.7 ms / 1075 cards versus
> `roundOrchard` 56.7 ms / 2117 cards) and pass the solidity gate with no holes at all.
>
> The profile that redirected §1: **~99% of generation time is the shell stage**
> (`bonsaiInformal` 537.9 ms of 541.9 ms), and within it the cost was not the candidate
> count but the greedy selector's coverage queries — `columnar` runs 28,800 candidates
> in *less* time than `bonsaiInformal` runs 11,200. Cutting candidate counts would have
> been the wrong lever.

Ordered by return on effort. Each item lists the files to touch, the exact change, and
how to verify it. Budgets target: **glade forest fully built < 2 s on a mid laptop,
steady state 60 fps, < 400 draw calls, no per-frame allocation in the LOD/wind path.**

Baseline first: record numbers from the existing perf HUD (`src/ui/performance-hud.js`,
`src/diagnostics/frame-statistics.js`) for `?scene=forest` glade/woodland before touching
anything, so every step below has a before/after.

---

## 1. Make shell generation cheaper (build time) — shipped, differently

> **What actually shipped.** Not 1a–1c below. Profiling showed the cost was in the
> greedy selector's coverage queries, not in candidate creation, so the fix was three
> exact optimizations that leave the output bit-identical: cache the per-cluster card
> basis, reject by the alpha shape's outer radius before sampling the texture, and
> replace the spatial grid's string cell keys with nested integer maps. Plus per-lobe
> neighbourhoods for the clearance scan. Detail and numbers in
> `research-leaf-placement-and-culling.md` §2.4.
>
> 1a and 1c below are **not** recommended as written: 1a's hash-derived lazy randomness
> reshuffles every existing tree for a gain the exact fixes already delivered, and 1c
> would trade solidity for a saving that is no longer the bottleneck. 1b shipped.

### Original plan, kept for the reasoning

**Files:** `src/generation/foliage-shell-generator.js`,
`src/generation/lobe-exposure.js`, new `src/generation/lobe-clearance-grid.js`.

The loop is `lobes × candidatesPerLobe` and each candidate is fully materialized before
scoring. Three changes, in order:

### 1a. Score first, materialize later
In `FoliageShellGenerator.generate` restructure `createCandidate` into two phases:

- **Phase A (cheap, every candidate):** direction → `pointOnLobeSurface`,
  `lobeSurfaceNormal`, clearance→exposure, outward/upward alignment, score.
  No sizing, no `outwardRatio`, no rotation/colorMix/windPhase draws.
- **Phase B (only for survivors):** run sizing + the remaining RNG-dependent fields for
  candidates that (a) beat `best` for the lobe or (b) pass `exposureThreshold`.

The current code draws from one shared `SeededRandom` stream, so skipping draws changes
every downstream value. **Switch candidate-local randomness to hash-derived values**
(`hashUnit(shellSeed, lobeId * 65537 + candidateIndex, salt)` — the same
`deterministic-hash.js` already used by `leaf-cluster-builder.js`) so each candidate's
random values are order-independent and lazy. Keep the per-lobe `phase` draw on the
shared stream (it happens once per lobe). This intentionally reshuffles existing trees
once; presets get re-tuned in the same PR (visual QA gates re-run).

### 1b. Stop scanning all lobes for clearance
`calculateLobeClearance` loops every lobe per candidate. Lobe count is 8–18 today but the
constant matters because it multiplies 10k–29k candidates. Build once per tree, before
the candidate loop:

- a coarse uniform grid (reuse `SpatialHashGrid`) of lobes keyed by
  `lobe.boundingRadius * (1 + CLEARANCE_SATURATION)`-inflated AABBs, or simply
- a per-lobe **neighbor list**: for each lobe, the other lobes whose inflated bounds
  intersect its own inflated bounds. Candidates on lobe L only test `neighbors[L]`.

Neighbor lists are the simpler win: O(lobes²) once (≤ 324 pairs) instead of
O(lobes × candidates × lobes). Expected clearance cost drop: 3–6×.

### 1c. Cut candidate counts, keep coverage
`candidatesPerLobe: 1600` (columnar) exists to satisfy the coverage gate with a uniform
Fibonacci sphere on *elongated* lobes. Two options, pick after measuring:
- Scale candidate count by lobe surface area (`4π·(abc)^(2/3)` approx) with a per-preset
  *density* instead of a flat count — elongated lobes get more, small lobes fewer.
- Halve counts and re-run `tools/run-shell-coverage-qa.js` to find the floor per preset.

**Acceptance:** `npm test` green; shell coverage QA green; generation time per tree
(measure around `TreeGenerator.generate` in the demo) drops ≥ 5× for columnar;
identical seeds keep producing identical trees run-to-run.

---

## 2. Gate QA analysis out of the runtime path — shipped

**Files:** `src/generation/tree-generator.js`, `src/rendering/branch-mesh-builder.js`,
QA runners in `tools/`.

- Add an option `analysis = false` to `TreeGenerator.generate` (or read a module-level
  flag set by QA runners). Only compute `tree.lodCostSummaries` when set. The demo HUD
  reads live metrics from `userData.lod`, not from this summary — verify with
  `grep -rn lodCostSummaries src/` and route any HUD use through the flag.
- Same for `analyzeBufferGeometryManifold` in `BranchMeshBuilder.build`: accept
  `{ analyzeManifold = false }`, populate `userData.structure` manifold fields only then.
  QA runners (`src/qa/*`, `tools/run-*.js`) pass `true`.

**Acceptance:** tests and QA tools still pass (they opt in); per-tree build time drops
measurably (manifold analysis runs 4× per tree today).

---

## 3. Zero-allocation, change-driven LOD updates (per frame) — shipped

**Files:** `src/rendering/tree-lod-controller.js`, `src/rendering/lod-dither-fade.js`,
`src/rendering/tree-lod-math.js`.

- **Cache fade targets at build.** In `configureObjectLodFade`, collect the level's
  materials into `level.userData.lodFadeMaterials` (array). `setObjectLodFade` then loops
  that array instead of `traverse()`. Re-collect when `buildHero`/`rebuildImpostor`
  mutate a level (they already call `configureObjectLodFade` — refresh the cache there).
- **Skip no-op fades.** Store `level.userData.lodFadeValue/-Invert`; return early when
  unchanged. Steady-state (most trees most frames) becomes ~4 float compares per tree.
- **Stop allocating weights.** Give `calculateLodWeights`/`remapUnavailableLodWeights`
  an optional `out` array param; controller keeps one scratch `Float32Array(4)` and one
  index scratch. Replace `weights.map().filter()` + `findIndex` with a plain loop that
  tracks the second visible index.
- **Stagger.** Add `updateStride` (default 2–4 in forest config): each frame process
  `entries[i]` where `i % stride === frame % stride`. Hysteresis already smooths level
  changes; wind/fades are unaffected. Keep stride 1 for the 12-tree garden.
- `TreeWindController`: replace `states.includes` with a `Set` mirror.

**Acceptance:** DevTools allocation profiler shows no per-frame garbage from
`TreeLodController.update` in a still camera; frame time in deepForest drops; LOD
switches still crossfade (visual check per `<when_to_verify>` workflow).

---

## 4. Share GPU resources per preset

**Files:** `src/rendering/tree-mesh-builder.js`,
`src/rendering/foliage-texture-set-factory.js`, material factories,
`src/rendering/tree-wind-shader.js`, `src/app/tree-demo.js`.

- **Texture cache.** `FoliageTextureSetFactory.create(palette)` → memoize by preset id
  (pass `presetId` in, hold a `Map`). Dispose management moves to the factory
  (`disposeAll()` on scene teardown) instead of `material.userData.disposables`.
- **Material sharing (the bigger step).** Today wind phase lives in per-material
  `windState`. Move per-tree wind phase out of the material:
  - add `uTreeWindPhase` as a **per-mesh** uniform via
    `mesh.onBeforeRender`-free route: keep one shared material per
    (preset × layer × LOD-role); set phase per tree through an
    `InstancedBufferAttribute` of length 1? No — simplest robust route in three.js:
    keep materials per *tree* but make them **clones sharing uniforms objects** except
    phase. Given the LOD fade is also per-level material state, full sharing needs fade
    to move per-mesh too. **Do this as its own PR**: replace `uTreeLodFade`/
    `uTreeWindPhase` material uniforms with a single `instanceTreeState` attribute on
    instanced meshes and a 2-float non-instanced attribute on merged structure meshes.
    Then one material per preset per layer serves every tree.
- **Payoff:** texture count −(2 × trees − 2 × presets); material instances from ~10/tree
  to ~10/preset; enables renderer-level state sorting; prerequisite for §5 batching.

**Acceptance:** `renderer.info.memory.textures` and `programs` shrink; visual parity
screenshots; wind still de-phased between trees (distinct `phase` per tree).

---

## 5. Forest-scale draw-call reduction: seed-variant pool + instancing

**Files:** `src/app/forest-scene.js`, `src/app/tree-demo.js`, new
`src/rendering/tree-variant-pool.js`.

Every tree today has a unique seed → unique geometry → its own draw calls. AAA foliage
(SpeedTree-style) uses a small variant pool:

- Forest layout picks `seed = pool[hash % V]` with V = 6–8 variants per preset instead of
  2 billion seeds. Rotation (already random), mirror (`scale.x *= -1` variant), and the
  existing 0.84–1.2 scale spread hide the repetition; nobody spots 8 variants in a
  150-tree stand.
- Build each variant **once**, then draw instances:
  - LOD2 (structure + cores) and LOD1 layers become `THREE.InstancedMesh` per
    (variant × layer) with per-instance matrix + the `instanceTreeState` attribute from
    §4 (fade, wind phase). LOD3 billboards are already batched.
  - LOD0 heroes stay per-tree unique meshes (only a handful are near enough at once) —
    keep the existing deferred hero path.
- The LOD controller gains a batched mode: instead of toggling per-tree groups for far
  trees, it writes fade/level into the instance attribute (one `needsUpdate` per batch).

Expected: glade steady-state draws drop from ~350–500 to **< 120**; build time drops
another ~20× for far rings (V builds instead of N). This is the single biggest
forest-scale win and the last structural one.

**Acceptance:** `renderer.info.render.calls` before/after in all three forest sizes;
frame time on integrated GPU; memory does not grow (variant geometries replace per-tree
geometries).

---

## 6. Small fixed cleanups — shipped

- `branch-generator.js`: replace `filter().sort()[0]` in `selectParent` and the sort in
  `attachLobes` with single-pass argmin loops.
- `tree-generator.js` `createClumpRecords`: build `terminalBranchIds` from one pass over
  `branches` into a `Map<macroClumpId, ids[]>`.
- `foliage-shell-generator.js`: `exposed` can hold tens of thousands of survivors before
  max-cover; pre-filter with a cheap grid-based "already dominated" test only if 1a–1c
  leave it hot in profiles.
- `scene-factory.js`: expose `renderer.info` reset hook for the HUD if not already.

---

## Sequencing

| PR | Items | Status |
|---|---|---|
| 1 | §2 QA gating + §6 cleanups | done |
| 2 | §3 LOD/wind frame path | done |
| 3 | §1 shell generation | done (exact optimizations, not the planned rewrite) |
| 4 | §4 resource sharing | open — largest remaining single win for forests |
| 5 | §5 variant pool + instancing | open — needs §4 first |

Measure with the perf HUD + `renderer.info` after each PR; stop when budgets at the top
are met — §5 is optional for the garden scene, essential for deepForest.

Anything measured from here on should be measured with `?wind=off`. Two runs of the
same build differ in 17.3% of their pixels with the wind running and in 0 with it
frozen, so it is the difference between an A/B that means something and one that does
not.
