# Tiny Glade look plan — exact work items

> **Status.** §1–§5 shipped. §1 (shader terms), §2 (`puff` card) and §3 (lighting, fog,
> shadow softness, exposure) went in with the `gladeCanopy` / `gladeBlossom` /
> `gladeBush` presets from `preset-glade.md`; §4 (post chain) and §5 (set dressing)
> followed. Two things were added that this plan did not originally name, because the
> snowy reference frame needs them — see §7.
>
> §4 gained a depth-of-field pass ahead of the bloom, which the original table did not
> list and which turned out to be the largest single contributor to the diorama read:
> the reference is mostly out of focus.
>
> The new light terms default to zero strength and the underside tint defaults to
> white, so every preset written before them renders exactly as it did; only the glade
> family opts in. Verified: `npm run check` (212 tests), the render smoke, the stem
> manifold gate, and the canopy solidity gate, whose failure list is unchanged from
> pristine `HEAD` (all of it pre-existing, at the LOD2–LOD3 crossfade, which carries no
> foliage cards).

Goal: trees and bushes that read like Tiny Glade's — big soft pastel canopy puffs with
pale sunlit tops, cool luminous undersides, scalloped silhouettes, warm dappled light,
and a gently bloomed, storybook frame — while staying inside the performance budgets in
`plan-performance.md`.

What produces that look in the reference (decomposed):

1. **Value structure per canopy:** near-white warm tops → mid pastel green → cool
   teal-shadowed underside. The gradient is dominated by *sky occlusion + height*, not by
   sun-facing alone. Shadows are luminous (high ambient), never black.
2. **Silhouette:** few large rounded puffs per crown (5–9), scalloped edges of soft
   overlapping discs, no visible individual leaves except sparse rim sprigs.
3. **Hue-shifted palettes:** shadow greens shift toward teal/blue, lit greens toward
   yellow/cream. Saturation is modest; lightness range is wide.
4. **Light rig:** warm low-ish sun, strong cool sky fill, very soft wide shadows, gentle
   fog the same hue as the sky.
5. **Post:** mild bloom on the brightest foliage, slight vignette, filmic tone map.
6. **Set dressing:** flower carpets and grass tufts sharing the palette; contact shadow
   blobs under crowns.

The existing pipeline already has the right bones (palette-texture shading, radial
normals, exposure/cavity/height terms, wrap light). The work is: extend the shader with
three missing light terms, add one leaf-alpha shape, retune lighting/fog, add a small
post chain, and ship the preset in `preset-glade.md`.

---

## 1. Shader: three new terms in `stylized-foliage-shader.js`

All three are a handful of ALU ops — no new textures, no extra passes. Add uniforms and
wire them from `foliage` config (new optional preset fields, validated in
`tree-preset.js` with defaults that reproduce today's look, so existing presets are
untouched).

### 1a. Cool underside tint (`undersideTint`, `undersideStrength`)
In `createColorShader()`, after `foliageSkyFactor`:

```glsl
float foliageDownward = clamp( -foliageRadial.y, 0.0, 1.0 );
vec3 foliageShadowTint = mix(
  vec3( 1.0 ),
  uFoliageUndersideTint,          // e.g. (0.62, 0.75, 0.78) — teal
  foliageDownward * uFoliageUndersideStrength
);
```
Multiply into the final color. This is the teal bottom-of-puff that the palette ramp
alone cannot give (the ramp is 1-D; this is directional).

### 1b. Sky rim ("halo") term (`rimStrength`, `rimPower`)
Needs the view vector: add `varying vec3 vFoliageWorldPosition` (set in the
`project_vertex` block from `worldPosition`); three.js provides `cameraPosition`.

```glsl
vec3 foliageView = normalize( cameraPosition - vFoliageWorldPosition );
float foliageRim = pow(
  1.0 - abs( dot( foliageView, foliageRadial ) ),
  uFoliageRimPower                 // ~2.5
);
float foliageTop = clamp( foliageRadial.y, 0.0, 1.0 );
diffuseColor.rgb += foliagePaletteColor * foliageRim * foliageTop *
  uFoliageRimStrength;             // ~0.35 — pale halo on upper silhouettes
```
This is what makes crown tops sparkle against the darker forest behind them.

### 1c. Backlight translucency (`translucencyStrength`)
```glsl
float foliageBacklight = pow(
  clamp( dot( foliageView, -normalize( uFoliageSunDirection ) ), 0.0, 1.0 ),
  3.0
);
diffuseColor.rgb += foliagePaletteColor * vec3( 1.05, 1.0, 0.72 ) *
  foliageBacklight * uFoliageTranslucencyStrength;  // ~0.22
```
Sun-through-canopy glow when looking toward the light — big "expensive foliage" signal
for one dot product.

Also: **soften `foliageFinePattern`** — current frequencies (17/11/19/13) read as noise
up close. Halve them and narrow the amplitude (`0.78,1.12` → `0.88,1.08`) so surface
breakup reads as paint dabs, not grain. Keep `surfaceBreakup` a config value; the glade
preset sets it low.

Bump the material `cacheKey`s (`foliage-shell-phase-2-5-v1` → `-v2` etc.) so programs
recompile, and re-capture impostors (already automatic — impostors capture live LOD2).

## 2. A `puff` leaf shape in `leaf-shape-library.js`

Existing shapes (broadleaf/maple/needle/willow) are leaf *sprays*. Tiny Glade cards read
as **cloud scallops**. Add:

```
puff: 7–9 large overlapping ellipses arranged in a fat fan
      (radiusX 0.16–0.22, radiusY 0.15–0.2, centers within |x| ≤ 0.24, |y| ≤ 0.3),
      soft edge falloff so alpha ramps over ~15% of the disc radius
```

Rationale: `FoliageAlphaTextureFactory` samples these blades into the 64px alpha map;
bigger, rounder, more-overlapped blobs + the existing `alphaToCoverage: true` (MSAA is
on) produce feathered scalloped card edges with zero material changes. Register the id in
`LEAF_SHAPES`; validation picks it up via `isLeafShapeId`.

Optional second pass (only if the 64px map bands visibly): raise
`alphaTextureResolution` to 128 in `foliage-rendering-constants.js` — one-time canvas
cost per preset, nothing per frame.

## 3. Lighting, fog, ground — `config/scene.yaml` retune

Exact values to start from (then eyeball in the browser):

```yaml
scene:
  backgroundColor: '#cfe3ea'   # paler, milkier sky
  fogColor: '#cfe3ea'          # must match background
  groundColor: '#8aa860'       # warmer meadow green
lighting:
  hemisphereSkyColor: '#dcecff'    # cool fill
  hemisphereGroundColor: '#7f9058' # warm grass bounce
  hemisphereIntensity: 2.1         # luminous shadows
  sunColor: '#ffe7bd'              # golden
  sunIntensity: 2.35
  sunPosition: [14, 12, 7]         # lower sun → longer, softer dapple
```

And in `scene-factory.js`:
- `sun.shadow.radius: 2 → 5` (PCFSoft — wide soft penumbra; static shadow map, so the
  wider kernel costs only on the rare re-render).
- `toneMappingExposure: 1.05 → 1.12`.
- Ground material: add slight vertex-color variation (see §5) or at minimum
  `roughness 1 → 0.95` so the meadow catches a hint of sun.

## 4. Post chain (new module `src/rendering/post-pipeline.js`)

`EffectComposer` with WebGL2 multisampled render target (keeps MSAA, keeps
alpha-to-coverage working):

| pass | settings | cost control |
|---|---|---|
| RenderPass | — | — |
| DepthOfFieldPass | focusRange 4.5, nearFalloff 5, farFalloff 26, blurRadius 0.011 | 16 taps, and only on pixels outside the sharp band |
| UnrealBloomPass | threshold 0.82, strength 0.28, radius 0.55 | run at half resolution |
| OutputPass | ACES + sRGB (moves tone mapping into the chain) | — |
| Vignette/grade | in OutputPass via small ShaderPass: vignette 0.12, saturation ×1.06, tiny warm lift in shadows | merged into one shader |

The depth of field runs first, and reads the depth the scene pass already wrote rather
than drawing the scene again the way three.js's own `BokehPass` does — a forest of
alpha-tested cards cannot afford a second geometry pass. Both of the composer's targets
carry their own `DepthTexture`, because either can be the buffer the scene last landed
in. It is a golden-angle disc rather than a separable Gaussian: a per-pixel radius is not
separable, and a two-pass version smears sharp subjects sideways before the second pass
can stop it. Focus follows the orbit target, so pulling the camera back deepens the melt
instead of defocusing the subject; walking, it rests at a fixed distance ahead.

- Config-gated: `renderer.post.enabled` in `scene.yaml`, default on for garden/glade,
  off below a pixel-ratio/GPU heuristic (reuse `maxPixelRatio` plumbing).
- **No SSAO pass.** The shader's cavity/exposure terms + contact blobs (§5) fake it at
  zero cost; N8AO/GTAO on a forest of alpha-tested cards is the classic frame-killer.
  Revisit only if profiling shows headroom.
- Resize path: `handleResize` in `tree-demo.js` must call `composer.setSize`.

## 5. Set dressing (sells the frame; all instanced, all cheap)

1. **Contact shadow blobs:** per tree, one `PlaneGeometry` decal at y≈0.02, radial
   gradient texture (one shared 64px canvas), `MeshBasicMaterial` multiply-blend, scale ≈
   crown radius × 1.1. One shared material + one InstancedMesh for the whole scene —
   1 draw call. Grounds every tree the way TG's do.
2. **Flower/grass carpet:** one `InstancedMesh` of cross-quads (2 tris × 2 planes),
   3–5k instances scattered by the forest RNG inside the clearing + tree line, colors
   sampled from a shared meadow palette (`#e9e2f2` `#c9a7d8` `#f0f4e0` `#9db7e6` +
   greens). Wind: reuse `applyCanopyWind` with tiny strength. 1–2 draw calls total.
3. **Ground color patches:** vertex-color the existing `CircleGeometry` (96 segments →
   keep) with low-frequency value noise (±6% lightness, hue nudged toward yellow in the
   clearing) — bakes "light pooling" into the meadow for free.

## 6. Winter — what the snowy reference needs that the summer one does not

The reference frame this plan was reopened against is the snow biome: white-laden
canopies, rust ones behind them, a pale milky sky. Two things carry it.

**Snow as a coverage, not a tint** (`snowColor`, `snowStrength`, `snowSharpness` in
`stylized-foliage-shader.js`). Mechanically it is the underside tint with the sign of
`foliageRadial.y` flipped, but it *mixes over* the canopy colour rather than multiplying
into it, because snow hides what is under it instead of shading it. It keeps
`foliageSkyFactor`, so snow inside a crown's cavity stays in shade rather than glowing.
`snowSharpness` is the whole difference between a laden crown (≈1.6, snow nearly to the
horizon of each puff) and a dusted one (≈2.8, caps only). Strength defaults to zero, so
every preset written before it is untouched.

The `gladeFrost` and `gladeRust` presets ship it. Their palettes are desaturated
independently of the snow: a summer green showing through the gaps in a snow-laden crown
reads wrong however white the caps are.

**What is still summer:** the scene around them. `scene.yaml` carries one sky, fog,
ground colour and light rig, so a winter *scene* — white ground, paler milkier fog,
a colder sun — is a scene-level swap, not a preset one. The presets are ready for it.

## 7. Crown silhouette

`gladeCanopy` ran ten lobes; counting scallops in the reference gets five to seven. It is
now seven, with `lobeScaleMultiplier` raised from 1.55 to 1.85 so the crown keeps its
volume — ten lobes at this radius read as a bumpy sphere, seven read as clouds pushed
together. `candidatesPerLobe` rises with it (448 → 640): candidates are drawn per lobe,
so dropping three lobes would otherwise have thinned the same surface by a third and
walked the covering out from under the coverage gate.

## 8. Ship order & verification

| step | depends on | proof |
|---|---|---|
| §3 lighting/fog retune | nothing | side-by-side screenshots, all presets |
| §1 shader terms + defaults | nothing | garden screenshots; existing presets unchanged with default-zero strengths |
| §2 puff shape | §1 optional | close-up card silhouettes |
| glade presets (`preset-glade.md`) | §1–§3 | the money shot vs. the reference |
| §4 post chain | §3 | before/after at 1080p; fps unchanged ±5% |
| §5 dressing | forest scene | clearing screenshot; draw-call delta ≤ +4 |

Verify each step in the browser preview (dev server via launch config), screenshot at the
default garden camera and inside the forest clearing, and check `renderer.info` draw
calls before/after. QA gates to re-run after §1–§2: canopy solidity, shell coverage
(alpha-aware — the puff shape changes guaranteed alpha radius, so
`foliage-alpha-profile.js` recomputes coverage from the new blades automatically).
