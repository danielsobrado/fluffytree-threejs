# Code review — tree generation & rendering pipeline

Scope: `src/generation/*`, `src/rendering/*`, `src/animation/tree-wind-controller.js`,
`src/app/forest-scene.js`, presets in `config/tree-presets.yaml`. Reviewed 2026-08-06.

## What is already good (keep it)

- **Clean layering.** Generation produces frozen, plain-data trees (`TreeGenerator.generate`);
  rendering consumes them; `src/domain/tree-preset.js` validates every knob with ranges.
  Determinism via `SeededRandom` + salted sub-seeds is consistent throughout.
- **Real LOD discipline.** Four levels with dither crossfade (`lod-dither-fade.js`),
  hysteresis (`tree-lod-math.js`), deferred hero build through a frame-budgeted queue,
  impostors captured from the exact level they replace, and atlas-batched billboards
  (`tree-billboard-batch-manager.js`). Static shadow maps (`shadowMap.autoUpdate = false`)
  with a dedicated low-poly shadow proxy is the right call.
- **The wind model.** Rigid per-tree translation (`tree-wind-shader.js`) is cheap, avoids
  card-vs-core interpenetration by construction, and the reasoning is documented in place.
- **QA culture.** Manifold analysis, LOD budget analysis, coverage gates. (But see P1 below —
  they currently run in the production path.)

## Findings

Ranked by impact. "Gen" = generation/build-time cost, "Frame" = per-frame cost.

### P0 (Gen) — Shell candidate generation is the dominant build cost
`src/generation/foliage-shell-generator.js`

`generate()` loops `lobes × candidatesPerLobe` and calls `createCandidate` for every
direction. Per preset that is:

| preset | lobes × candidates | candidate objects |
|---|---|---|
| roundOrchard | 16 × 640 | 10,240 |
| columnar | 18 × 1600 | **28,800** |
| bonsai* | 16–17 × 640–720 | ~11,000 |

Each candidate:
- calls `calculateLobeClearance` (`lobe-exposure.js`) which loops **all other lobes** →
  O(lobes² × candidates) distance evaluations (~500k for columnar);
- allocates ~8 short-lived objects (`surfacePoint`, `normal`, `position`, `outward`,
  sizing record, the candidate record itself);
- draws 5–6 values from the RNG **even when the candidate will be discarded** (most are:
  only `exposure >= exposureThreshold` candidates and one best-per-lobe survive scoring).

In the forest scene (`forest-scene.js`, glade: `heroRadius: 82` == `radius: 82`) **every**
tree has `minimumLod 0`, so every tree runs full shell generation through the build queue.
This is the main reason time-to-fully-built-forest is long. Fixes are in
`plan-performance.md` §1.

### P0 (Gen) — QA analyzers run in the production build path
- `TreeGenerator.generate` ends with `analyzeTreeLodBudgets(tree)`
  ([tree-generator.js:129](../src/generation/tree-generator.js)) for every tree.
- `BranchMeshBuilder.build` runs `analyzeBufferGeometryManifold(trunkGeometry)`
  ([branch-mesh-builder.js:44](../src/rendering/branch-mesh-builder.js)) — and it is called
  up to **4× per tree** (lod1, lod2, hero, shadow proxy). Manifold analysis walks every
  edge/triangle with hashed maps; it exists for QA runners, not for the render path.

These are pure overhead for players. Gate them behind a flag (perf plan §2).

### P1 (Frame) — LOD controller allocates and traverses every frame
`src/rendering/tree-lod-controller.js` `update()` — per tree, per frame:
- `calculateLodWeights` + `remapUnavailableLodWeights` return fresh arrays;
- `weights.map(...).filter(...)` allocates two more arrays plus closures;
- `setObjectLodFade(level, …)` is called on **all four levels** and each call
  `traverse()`s the level subtree even when the fade value did not change
  (`lod-dither-fade.js:49`).

At forest scale (150–400 trees) this is thousands of allocations plus scene-graph
traversals per frame — measurable GC/driver overhead. Fix: cache per-level material
lists once at build, skip levels whose fade is unchanged, stagger updates (perf plan §3).

### P1 (Frame/GPU) — Per-tree materials and textures defeat batching
Every `TreeMeshBuilder.build` creates a fresh texture set
(`FoliageTextureSetFactory.create` — palette + alpha canvas textures **per tree**) and
fresh materials per level (bark, core, shell, hero leaves ≈ 10 materials/tree). Programs
are shared via `customProgramCacheKey`, but:
- ~2 canvas textures × N trees of the same preset are identical → redundant GPU uploads
  and binds;
- unique material instances mean per-draw uniform re-upload and no chance of render-state
  sharing;
- draw calls scale linearly: LOD0 ≈ 4–5, LOD1 = 3, LOD2 = 2 per tree. A 150-tree glade
  sits around 350–500 tree draws before shadows.

Fix: share texture/material per preset (wind phase must move from material state to a
per-mesh uniform), and add a seed-variant pool + instancing for forests (perf plan §4–5).

### P2 (Gen) — Quadratic small-n patterns in branch generation
`src/generation/branch-generator.js`:
- `selectParent` does `filter().sort()[0]` over all branches **per lobe** — O(n² log n).
  A single-pass min is enough.
- `attachLobes` sorts all branches per lobe for the fallback path — same fix.
- `createClumpRecords` (`tree-generator.js:44`) filters all branches per clump.

n is small (tens), so this is cleanliness more than speed — but the fix is trivial and
they run per tree at build.

### P2 (Frame) — `TreeWindController.register` linear scan
`this.states.includes(state)` → O(n²) across registrations
([tree-wind-controller.js:25](../src/animation/tree-wind-controller.js)). Use a `Set`.
Also `update()` iterates a plain array every frame — fine, but the array never shrinks on
scene switch except via `clear()`; verify scene menu calls it (it does).

### P2 (Memory) — Retained instance records are AoS object graphs
Each shell instance is a ~24-field object (`foliage-shell-generator.js` `instances.map`),
duplicated in `tree.shell` and `tree.sprayRecords` (same frozen array — fine, shared ref),
consumed once by builders and then retained on frozen `treeData` for the life of the tree.
A 150-tree glade retains ~40–60k such objects. SoA typed arrays would cut this ~5–10×.
Do this only if memory profiling shows pressure; it touches many consumers.

### P3 (Correctness watch-outs, no action needed yet)
- `branch-generator.js:263` `sourceLobes[parent.targetLobeId]` indexes the array by lobe
  id — correct only while `lobe.id === array index`. Holds today (lobe generator assigns
  sequential ids); worth an assertion if lobe filtering is ever added.
- `coverOnlyCoreScale` (`tree-mesh-builder.js:21`) divides by `palette.core.scale`;
  validated min 0.55 so safe.
- `TreeLodController` prewarm enqueues `buildHero` with key `${uuid}:hero` every frame
  while pending — dedup relies on the queue keying; confirmed `frame-budget-queue.js`
  keys tasks, OK.

## Verdict

Architecture is genuinely strong — the work to reach "AAA at forest scale" is not a
rewrite, it is: (1) cut generation cost per tree, (2) get QA out of the hot path,
(3) stop per-frame allocation/traversal, (4) share GPU resources per preset, and
(5) add the missing visual layer (see `plan-tiny-glade-look.md`).
