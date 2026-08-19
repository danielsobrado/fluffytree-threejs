# Research — leaf placement, hole-free hollow crowns, and back-area culling

The crown is a shell: leaf cards (fins) over opaque low-poly cores, **void inside, no
interior branches**. This document is the theory and the exact engineering plan for
making that illusion (a) provably hole-free from every allowed camera angle, (b) cheaper
to place, (c) cheaper to draw via culling of the back areas, and (d) stable under wind —
with as much as possible precomputed per tree *type* instead of per tree.

Everything here is grounded in the current code: `foliage-shell-generator.js`,
`foliage-shell-builder.js`, `foliage-shell-geometry-factory.js` (fins),
`foliage-alpha-profile.js` (guaranteed alpha radius), `foliage-lod-selector.js`,
`tree-wind-shader.js` (rigid sway), `foliage-rendering-constants.js`, and the canopy
solidity probe in `src/diagnostics/`.

---

## 1. The geometry of see-through: a ray taxonomy

Fix one lobe: shell surface at radius `r_s` (ellipsoid), opaque core at effective scale
`s = core.scale × coreScaleMultiplier ≈ 0.67 × 1.35 ≈ 0.90` of the lobe (LOD0/1). Every
camera ray that enters the crown is one of:

| ray class | what must stop it | failure mode |
|---|---|---|
| **R1 interior** — enters the shell heading *inside* the core silhouette | the core | none (core is opaque) — this is why the void works |
| **R2 rim** — passes through the annulus between core silhouette and shell silhouette | a fin | **the only true hole risk**: sky visible through the crown edge |
| **R3 between-lobe** — passes through a crevice between lobes | a neighbouring core (they overlap by design, `coreScaleMultiplier` comment) or a fin | thin see-through slits in crevices |
| **R4 under-canopy** — first-person camera under the crown looking up | underside fins + core underside | glowing sky pinholes overhead |

**Consequence 1 — the hole problem is a *rim band* problem.** For a sphere-ish lobe, the
projected rim annulus has width `r_s(1 − s) ≈ 0.10·r_s`. Only fins whose projection
lands in that annulus (plus R3/R4 zones) are load-bearing for opacity. Everything else
is *texture*, not *seal*. Placement and LOD should therefore price fins by **rim duty**,
not treat the surface uniformly.

**Consequence 2 — fins and cores split the duty by view angle, and the split is exact.**
The fins contain the outward axis (LOCAL_OUTWARD = +Z is the radial direction; planes are
twist-distributed around it — that is what "fin" means here). Let `φ` be the angle
between the view ray and the fin's outward axis:

- `φ → 0` (radial view, looking straight at the lobe surface): fins are seen edge-on and
  cover almost nothing — but a radial ray is class R1 and the **core** catches it.
- `φ → 90°` (grazing/rim view): the core no longer helps — but now each fin projects at
  up to full width. With `P` fins twist-distributed at `π/P` spacing, the best fin's
  projected width is at least `w·sin(π/(2P))`… for `P = 2` (crossed at 90°):
  `w·cos(45°) ≈ 0.71·w`.

So the *worst* direction for fins is precisely the *best* direction for the core, and
vice versa. This is the mathematical reason the hollow-crown trick works at all, and it
gives us the correct safety factor: **all coverage guarantees below use the grazing-view
effective radius `ρ_eff = ρ_alpha · sin(π/(2P))`**, where `ρ_alpha` is the guaranteed
alpha radius from `foliage-alpha-profile.js` (`alphaCoverageRadius` on each sample). For
A2C safety, define `ρ_alpha` at alpha ≥ max(`alphaTest`, 0.75) so 4×MSAA dither never
opens sample-level pinholes inside the "guaranteed" disc.

---

## 2. Placement as a spherical covering (with a certificate)

### 2.1 Today, and what to replace

Today (`foliage-shell-generator.js`): scatter `candidatesPerLobe` Fibonacci directions,
score each (exposure/outward/upward/jitter), then greedy max-cover at
`stopCoverageRatio 0.5`. It works, but it *searches* for a covering stochastically —
10k–29k candidates per tree to keep ~200–300 — and its guarantee is empirical (the QA
gate), not constructive.

> **Correction from measurement.** The construction below assumes the covering radius
> can be priced against each card's *guaranteed* alpha disc. Measured against the real
> presets, that assumption is far too conservative to use directly: the covering radius
> the existing greedy actually maintains is `0.5 × coverageCardRatio × cardWidth`, which
> is **3.1–4.0× larger** than the guaranteed disc for every leaf-spray preset.
>
> | preset | shape | guaranteed r/cardWidth | covering r/cardWidth | ratio |
> |---|---|---|---|---|
> | roundOrchard | broadleaf | 0.0798 | 0.2720 | 3.41 |
> | columnar | broadleaf | 0.0798 | 0.3200 | 4.01 |
> | bonsaiInformal | maple | 0.0994 | 0.3405 | 3.42 |
> | autumnBush | broadleaf | 0.0798 | 0.2445 | 3.07 |
>
> The gap is not slack — it is load-bearing. `foliageCardCoverageRatio` tests the point
> against the card's *actual blade alpha*, not its inscribed disc, so coverage is
> carried by the leaf spray's arms reaching well past the disc. A disc-priced lattice
> would need roughly an order of magnitude more cards, which is a large regression, not
> an optimization. **So the lattice rewrite was not shipped.** What shipped instead is
> the semantics-preserving optimization of the existing selection (§2.4) and a leaf
> shape whose guaranteed disc is actually large enough for the disc bound to bind (§2.5).

**Replace search with construction.** The requirement "no surface point farther than
`ρ_eff·coverageCardRatio` from a fin centre" is, verbatim, the definition of a
**spherical covering** with covering radius `ρ_cov`. Coverings are a solved problem:

- A Fibonacci lattice of `N` points has covering radius `ρ_cov(N) ≈ 1.28·√(4π/N)/2`
  (near-optimal; within ~15% of the best known coverings).
- Therefore, given the card's angular radius on its lobe
  `ρ̂ = ρ_eff / r_lobe` (radians), the number of fins *needed* is known in closed form:

  ```
  N(lobe) ≈ 4π · (1.28 / (2·ρ̂·c))²        with c = coverageCardRatio
  ```

- Ellipsoids: apply the covering in the unit-sphere parameter space of the lobe, then
  push through the lobe's affine transform. Angular distortion is bounded by the axis
  ratio; fold the worst-case stretch `max(scale)/min(scale)` into `c` (conservative), or
  redistribute with 2–3 Lloyd relaxation steps in the stretched metric (precomputed —
  see §5, so the cost is irrelevant).

**The certificate:** by construction every surface point is within `ρ_cov ≤ ρ_eff·c` of
a fin centre, and §1 gives `ρ_eff` as the worst-view projected radius ⇒ **no rim ray of
width > slack can pass between fins, from any direction, at any wind phase (§4)**. The
existing QA probe demotes from *tuning tool* to *regression test*.

**Organic look without losing the certificate:** the covering leaves slack
`Δ = ρ_eff·c − ρ_cov(N)`. Jitter each point by at most `Δ·0.8` (deterministic
`hashUnit`), randomize twist `rotation` freely (twist does not move the guaranteed
disc's centre), and keep the existing per-fin `colorMix`/size variation *within* the
sizing bounds already validated by `tree-preset.js`. Size variation: draw the size
first (hash), then the *coverage math uses each fin's own* `ρ_alpha` — the covering is
built greedily from the largest size class down (precomputed anyway).

This deletes `candidatesPerLobe`, `exposureThreshold` scoring, and the greedy selector
from the runtime path entirely — the strongest version of `plan-performance.md` §1
(supersedes 1a–1c). Exposure is still needed for shading (`instanceExposure`): compute
it only for the ~N final points, against the §2.3 neighbour lists — ~50× fewer clearance
queries than today.

### 2.2 Zonal pricing (performance without new risk)

Weight the covering by ray-class duty, not uniformly:

- **Rim-critical zone** (R2/R3): points whose outward normal is within ±35° of the
  horizontal band swept by allowed cameras (orbit `maxPolarAngle 0.48π` + first-person:
  effectively all azimuths, elevations from grazing to top-down) → full density, the
  smaller end of `sizeRatio`, full `planesPerCluster`.
- **Underside** (R4, seen close-up in shade): density can drop ~35% if `sizeRatio` rises
  ~25% (covering count scales with `1/ρ̂²` — bigger cards are quadratically cheaper).
  Detail is invisible in canopy shade; solidity is what matters.
- **Top cap**: no discount. Counter-intuitively the cap is *always* rim-critical: for a
  horizontal camera the silhouette is the great circle over the pole, so cap fins seal
  the top rim in every azimuth — which also rules out `planesPerCluster 1` there (one
  fin plane is edge-on for the perpendicular azimuth, and the ray grazing the core's
  top is class R2, not R1). Encode the zones as a per-zone table in the preset
  (`shell.zones`, new, optional).

Net effect for `gladeCanopy`-class presets: **~25–35% fewer fins at equal or better
worst-angle solidity**, because today's uniform scatter over-serves R1 territory that
the core already seals.

### 2.4 What shipped instead: the same selection, 2.8× faster

Profiling put ~99% of generation in the shell stage, and inside it the cost was not the
candidate count but the greedy's coverage queries. Three exact changes, no output
change at all (identical instance counts, seed for seed):

1. **Cache the card basis.** `foliageCardCoverageRatio` rebuilt a quaternion basis and
   two vector rotations *per comparison*, for a value constant per cluster. Cached in a
   `WeakMap` on the cluster.
2. **Reject by radius before sampling.** The alpha profile gained
   `maximumRadiusRatio`, the radius containing every opaque texel (plus one texel
   diagonal for bilinear spill). A point outside it cannot be opaque on any plane, so
   the bilinear fetches are skipped. Exact, because all four texels a fetch would blend
   are then transparent.
3. **Integer grid cells.** `SpatialHashGrid` built a `${x}:${y}:${z}` string for each of
   twenty-seven cells per query — more allocation than the selection it served. Now
   nested integer-keyed maps, which is exact where a numeric hash of the triple would
   collide and silently merge cells.

Plus per-lobe neighbourhoods for the exposure clearance, exact by the triangle
inequality against the reach test the per-point check already applied.

Measured, min-of-7 per preset, whole-tree generation: **2472 ms → 889 ms** for one tree
of every preset, with shell instance counts unchanged to the integer.

### 2.5 The shape that makes the disc bound bind

The `puff` card added for the glade presets is not a leaf spray but a rounded mass with
a scalloped rim, and that changes the coverage arithmetic outright:

| shape | guaranteed r/cardWidth | max opaque r | opaque fill |
|---|---|---|---|
| broadleaf | 0.0798 | 0.522 | 43.3% |
| maple | 0.0994 | 0.564 | 39.5% |
| needle | 0.0994 | 0.519 | 33.1% |
| **puff** | **0.2835** | 0.406 | 37.0% |

At 0.2835 the guaranteed disc alone satisfies a covering with
`coverageCardRatio ≤ 2 × 0.2835 = 0.567`. The glade presets sit at 0.56, so their
canopies are solid **by the disc bound**, not by their blades happening to overlap —
the certificate §2 asks for, obtained by changing the card rather than the search.
The result is measured: `gladeCanopy` renders `hole=0.00000, largest=0.00000` at its
worst view in the solidity gate while carrying ~half the cards of `roundOrchard`
(1075 vs 2117) and generating in half the time (27.7 ms vs 56.7 ms).

### 2.6 Union trimming and crevices (R3) — not yet built

Cull covering points that fall *inside* a neighbouring lobe (they draw fill-rate and
seal nothing — the neighbour's surface has its own covering). Use the per-lobe neighbour
lists from `plan-performance.md` §1b. Then guarantee the crevice seam: for each
neighbour pair, the intersection circle gets a ring of fins at the same `ρ_cov` spacing
(the two lobes' coverings both end at the seam; a ring guarantees the junction). This is
what currently emerges *by luck* from high candidate counts.

---

## 3. Back-area culling — precomputed occlusion cones

### 3.1 The observation

A fin on the far side of the crown, entirely behind the opaque core's silhouette,
contributes nothing: every ray to it passes through the core first (class R1 from the
back). It can be skipped — **but only conditionally**: near the rim it *is* the
silhouette (§1), and which fins are "back" changes with every camera move.

### 3.2 Exact per-fin visibility cone (precomputable)

Sphere-conservative bound: inscribe a sphere of radius `r_c` (min semi-axis × effective
core scale) in the fin's own lobe core, centred at `c`. For a fin whose *farthest
guaranteed-opaque point* sits at distance `r_q = ‖q − c‖ + tip extent` from the centre,
the core occludes the whole fin from every view direction `w` (unit vector fin→camera)
inside the cone:

```
dot(w, d) > cosθ      where d = normalize(c − q)         (points inward)
                      cosθ = √(1 − (r_c / r_q)²) + ε_margin
```

(The set of rays from a point at radius `r_q` that hit a sphere of radius `r_c` is a
cone of half-angle `arcsin(r_c/r_q)` about the inward axis; using the fin's *outermost*
point makes it conservative for the entire quad.) Precompute per instance a single
`vec4(d, cosθ)` — static geometry, so it bakes (§5). Where a *neighbour* core is a
better occluder, take the max-`cosθ` candidate among {own lobe, neighbours} at bake
time; still one vec4.

**Measured, after implementing it** (`src/rendering/foliage-occlusion-cone.js`, cull
fraction sampled over the view envelope at three camera distances):

| preset | 6 m | 12 m | 25 m |
|---|---|---|---|
| gladeCanopy | 11.0% | 7.9% | 6.5% |
| roundOrchard | 11.3% | 8.5% | 7.2% |
| columnar | 3.9% | 3.3% | 2.9% |
| bonsaiInformal | 0.3% | 0.3% | 0.3% |

This is well below the 15–25% first estimated here, and the reason is worth keeping:
the occluder is the sphere **inscribed** in the core ellipsoid, so a flattened pad
crown (bonsai, `verticalScale` 0.44–0.62) has almost no inscribed radius to work with
and almost nothing is ever provably hidden. Round crowns near the camera — which is
exactly where cards are drawn, since the shell only exists at levels 0 and 1 — get the
full ~11%. Treat this as a real but modest win concentrated on round crowns, not as a
headline optimization; the honest summary is a few percent of foliage cost.

### 3.3 Implementation: vertex collapse, zero draw calls, zero CPU

WebGL2 has no `baseInstance`, so per-frame instance-list rebuilds are the wrong tool.
Instead cull in the vertex shader — the test is exact for finite cameras because `w` is
computed per vertex:

```glsl
// instanced attribute: vec4 instanceOcclusion;  // xyz = d (tree-local), w = cosθ
// tree-local camera: inverse(modelMatrix) * cameraPosition — or transform d out
vec3 finToCamera = normalize(cameraPositionLocal - instancePosition);
if (dot(finToCamera, instanceOcclusion.xyz) > instanceOcclusion.w) {
  gl_Position = vec4(2.0, 2.0, 2.0, 0.0);   // collapse; primitive clipped
  return;
}
```

Hook it into `configureStylizedFoliageShader` next to the wind block; the attribute is
added by `instanced-foliage-attributes.js`. Cost: one dot + compare on 8 vertices per
fin. No bucketing, no popping (the cone test is continuous), no per-frame CPU work at
all — the camera position uniform is already there.

### 3.4 Honest cost model — where this actually pays

Be precise about what is saved, because the pipeline already has partial protection:
shells draw at `renderOrder 1`, after all opaque cores scene-wide, so hidden back-fin
fragments usually die in **early-Z**. But:

1. `discard`/alpha-test shaders disable early-Z *write* optimizations and, on several
   mobile/integrated GPUs (and under A2C on some drivers), degrade early rejection —
   exactly the low-end hardware the forest scene struggles on. Vertex collapse removes
   the fragments *before* rasterization on every GPU.
2. Early-Z only helps where the core has already written depth *closer* than the fin.
   At the crossfade edges (dithered LOD fades punch holes in the core's depth) and for
   R3 crevice fins occluded by a *neighbouring* tree's core (different draw, ordering
   not guaranteed within `renderOrder 1`), fragments run anyway.
3. Culled fins also skip the (small) raster setup and varying interpolation cost, which
   at forest scale is thousands of quads per frame.

Expectation to validate: **5–12% GPU frame time on iGPU in forest views, ~0–3% on
discrete desktop** — cheap enough to be worth it at ~zero complexity, but measure
(`EXT_disjoint_timer_query_webgl2` on the forest flythrough) before declaring victory.
Given the measured cull fractions above, scale that expectation down accordingly: the
saving is bounded by the fraction culled, and on pad crowns it is nil.

**Verified invisible.** The property this whole section rests on — that the cull removes
work and never a pixel — is now a test rather than an argument. With `?wind=off` the
render smoke is bit-exact across runs (0 differing pixels of 1,296,000), and rendering
the garden with the cull enabled and disabled gives **0 differing pixels**. Without the
frozen wind the same comparison is worthless: two runs of the *same* build differ in
17.3% of their pixels, which is larger than any change being measured.

Correctness interactions, all verified against the code:
- **LOD crossfade:** shell exists only in LOD0/1, and each level draws its own core
  whenever it draws its shell — the occluder is always present. Impostor (LOD3) has no
  shell. Safe.
- **Camera inside the crown** (first-person under a low bush): the cone test uses the
  true per-vertex `w`; a fin behind the core relative to an interior camera is still
  genuinely hidden. Safe.
- **Shadows:** fins don't cast (`castShadow false`; the shadow proxy is separate).
  Cull affects the camera pass only. Safe.
- **Wind:** see §4 — the cones ride the rigid sway unchanged.

### 3.5 What not to do (rejected alternatives)

- **Per-frame CPU re-sorting / index rebuild** — O(instances) CPU per tree per frame,
  fights `StaticDrawUsage`, and loses to the free vertex test.
- **Direction-bucketed instance ranges** (8–24 prebaked lists): needs `baseInstance`
  (absent in WebGL2) or duplicated buffers; introduces bucket-switch popping. Keep as a
  WebGPU-era option where GPU-driven compaction (compute pass writing an indirect draw)
  is the modern form — that is the "GPU-driven rendering" lane Tiny Glade itself is in
  (custom engine; see references).
- **Hemisphere test `dot(n, view) < 0`** — wrong: it culls rim fins (holes at the
  silhouette). The cone offset by `cosθ` is the correct, hole-safe generalization.

---

## 4. Wind, and why precomputation survives it

The wind model (`tree-wind-shader.js`) is a **rigid translation per tree** — every
canopy vertex displaced by the same `treeWindSway()` vector; the wood bends to meet it.
Two theorems fall out for free, and they are the reason this whole document can lean on
precomputation:

1. **Coverage invariance.** Rigid motion preserves all pairwise distances and all
   angles inside the crown ⇒ the covering certificate (§2) holds at every wind phase
   exactly, not approximately. No wind margin is needed in `ρ_cov`.
2. **Cone invariance.** Fin positions and core centres translate together ⇒
   `d = normalize(c − q)` and `cosθ` are constant ⇒ the baked `instanceOcclusion`
   attribute never goes stale. (The camera-relative `w` changes, but that is computed
   live.) The only caveat: apply the cull test to the *pre-wind* instance position or
   equivalently add the sway to `cameraPositionLocal` — one uniform subtract, since the
   sway is uniform per tree.

**Budget for richer wind later.** If per-clump phase offsets or vertex flutter are ever
wanted, cap the *relative* canopy displacement at `δ` and spend the existing slack:

```
coverage:   need   δ ≤ Δ·r_lobe   (Δ = jitter slack reserved in §2.1, in radians)
cones:      widen  θ by arctan(δ / r_q)
```

With today's numbers, `δ` up to ~3–4 cm is free. Better: keep geometry rigid and add
**shading-only flutter** — the per-fin `windPhase` attribute already generated by
`foliage-shell-generator.js` (and currently unused by the shader) can drive a small
normal wobble / brightness ripple in `stylized-foliage-shader.js`. Full Tiny-Glade
liveliness, zero geometric risk, zero new data.

---

## 5. Precomputation architecture — "leaf positions per tree type"

Three tiers, from cheapest to bake to biggest payoff:

### Tier 1 — per *preset*: canonical unit coverings (boot-time, ~ms)
The §2 covering depends only on `ρ̂·c` — i.e. on preset fields
(`sizeRatio`, `widthRatio`, `coverageCardRatio`, `planesPerCluster`, alpha profile,
zone table) — **not on the seed and not on the lobe**. Bake once per preset at boot
(or ship as JSON): an array of unit directions + jitter offsets + twist + size class +
zone id, in **farthest-point (progressive) order** — see Tier 3. Per tree, per lobe:
push the table through the lobe's affine transform, trim against neighbour lobes (§2.3),
hash colors. Per-tree placement cost collapses from ~10⁴ scored candidates to ~10²
transforms.

### Tier 2 — per *variant*: baked instance buffers (build-time, cacheable)
With the variant pool (`plan-performance.md` §5: 6–8 seeds per preset), bake each
variant's final GPU-ready arrays — instance matrices, `instanceColorMix/Exposure/
CrownDirection`, `instanceOcclusion` (§3.2), windPhase — as `Float32Array` blobs.
Cache in IndexedDB keyed by `hash(presetConfig + generatorVersion + seed)`; cold load
regenerates, warm load uploads directly. Forest startup stops doing placement work at
all. (Garden/tuning-panel path keeps live generation — tuning must stay interactive.)

### Tier 3 — progressive ordering = free LOD (the clever one)
Order each covering by **farthest-point traversal** (first the per-lobe anchor points so
every lobe is sealed from entry 1, then globally farthest-first). Property: *every
prefix of length K is itself a near-optimal covering* with radius `ρ_cov(K) ≈
ρ_cov(N)·√(N/K)`. Then:

- **LOD density becomes `mesh.count = K`.** `selectFoliageLodInstances` (hash filter +
  scale compensation) is replaced by a table: for target density `q`, use
  `K = ⌈qN⌉` and the *precomputed* per-prefix scale compensation
  `scaleComp(K) = ρ_cov(K)/ρ_cov(N)` — solidity-preserving by construction, no per-LOD
  instance buffers, no re-selection. LOD1's `mediumShellDensity 0.75` and the hero
  interior layer both become prefix lengths on one shared buffer.
- Fade between densities by animating K with the existing dither (fade the tail range
  in via `instanceIndex >= K_old` test if per-instance fade is ever wanted — optional).
- Memory: one instance buffer per tree (or per variant) serves LOD0 *and* LOD1 —
  today's separate `foliage-shell-lod1` build disappears.

---

## 6. View-importance envelope

Allowed cameras today: orbit (`minDistance 7`, `maxPolarAngle 0.48π` → from straight
overhead down to ~3.6° above horizontal) plus first-person walk (eye ~1.7 m, can stand
under crowns). Encode this as a preset-independent **view envelope** used twice:

1. §2.2 zone weights (which surface zones are rim-critical for which elevations);
2. the QA sweep (§7) samples exactly this envelope, so the certificate and the test
   agree on what "every angle" means.

If a future scene unlocks free flight, only the envelope constant changes and the QA
sweep re-runs; placement math is already worst-case over the envelope.

---

## 7. Validation protocol

Extend the existing canopy-solidity machinery (`src/diagnostics/`,
`config/canopy-solidity-qa.yaml`) into a sweep gate:

1. **Directions:** 42 icosphere directions intersected with the view envelope (§6),
   plus 8 under-canopy first-person poses per preset.
2. **Wind:** two phases (0 and π/2) — by §4 they must match to the pixel for rigid
   wind; a diff catches any future accidental non-rigid displacement.
3. **Culling on/off:** render each direction with §3 culling enabled and disabled;
   images must be identical (the cull is defined as invisible-work removal — any pixel
   diff is a bug in a cone margin).
4. **Metric:** max see-through blob size in px at 300 px projected tree height
   (existing solidity metric); budget 0 blobs > 1 px. Track fin count and GPU time per
   preset in the same report so solidity and cost move together visibly.

---

## 8. Rollout (each step independently shippable)

| step | change | status |
|---|---|---|
| 1 | exact speed-ups to the existing selection (§2.4) | **shipped** — 2472 ms → 889 ms, identical output |
| 2 | `puff` card, so the disc bound binds (§2.5) | **shipped** — glade presets solid at half the cards |
| 3 | `instanceOcclusion` bake + vertex-collapse cull | **shipped** — 0 differing pixels, 0.3–11% culled |
| 4 | `?wind=off` so any two builds can be compared at all | **shipped** — renders now bit-exact across runs |
| 5 | covering-lattice placement | **not shipped** — see the correction in §2.1 |
| 6 | progressive ordering + prefix LOD | open; depends on 5 |
| 7 | union trimming and crevice rings (§2.6) | open |
| 8 | Tier-2 variant blob cache (IndexedDB) | open; needs the variant pool |
| 9 | shading-only flutter from the unused `windPhase` attribute | open, cosmetic |

Step 5 is the one to reopen only with the effective-radius calibration §2.1 now calls
for: an "effective covering radius" derived from the card's real alpha coverage rather
than from its inscribed disc. The `puff` shape sidesteps the need for the glade family
by making the two nearly coincide.

---

## 9. Prior art this leans on

- **Tiny Glade's own rendering talk** — T. Stachowiak, *Rendering Tiny Glades With
  Entirely Too Much Ray Marching*, Graphics Programming Conference 2024
  ([video](https://www.youtube.com/watch?v=jusWW2pPnA0),
  [discussion](https://news.ycombinator.com/item?id=42349252)): custom GPU-driven
  engine; the reference point for "soft mass first, detail second" canopies and for
  where WebGPU-era GPU-driven culling of this pipeline would go (§3.5).
- **Billboard clouds** — Décoret, Durand, Sillion, Dorsey, SIGGRAPH 2003: representing
  volumes by few alpha cards; our fins are a constrained billboard cloud with an
  opacity certificate.
- **Volumetric billboards** — Decaudin & Neyret 2009; and Bruneton & Neyret,
  *Real-time Realistic Rendering and Lighting of Forests* 2012: view-dependent
  canopy opacity models (what our core+fin split approximates analytically).
- **SpeedTree** LOD practice: card/fin crossfades, per-archetype baked variation —
  the industry baseline for §5's variant pools.
- **GPU-driven scatter & cull** — *GPU-Based Procedural Placement in Horizon Zero
  Dawn* (GDC 2017); Ghost of Tsushima's grass pipeline (GDC 2021): precomputed
  placement tables + GPU compaction; our Tier 1/2 is the CPU-precomputed form of the
  same idea, sized for WebGL2.
- **Spherical coverings / Fibonacci lattices** — González 2010 (*Measurement of areas
  on a sphere using Fibonacci and latitude–longitude lattices*) and the known covering
  tables: the closed-form `N(ρ)` in §2.1.
- **Alpha-to-coverage & early-Z behaviour with discard** — vendor guidance (ARM/Qualcomm
  best-practice docs) motivating §3.4's claim that vertex-collapse beats relying on
  early-Z on tile/iGPU parts.
