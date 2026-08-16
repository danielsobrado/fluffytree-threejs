# Universal SOTA Tree Generator Roadmap

## Purpose

This document defines the technical roadmap for evolving `fluffytree-threejs` from a high-quality procedural broadleaf tree demo into a universal, production-oriented, state-of-the-art procedural tree and vegetation system suitable for AAA-style real-time worlds.

The target is not simply to support more tree presets. The target is to build an architecture where fundamentally different plant families can be generated, compiled into multiple runtime representations, streamed, animated, culled and rendered under strict performance budgets without forcing every species through one morphology algorithm.

The system must remain deterministic, configurable, testable, performant and visually stable. Existing quality work around canopy continuity, foliage coverage, deterministic generation, LOD transitions, impostors and runtime QA must be preserved and generalized rather than replaced.

---

## Core Goals

The final system should provide all of the following:

1. A universal tree representation independent from any one generation algorithm.
2. Multiple botanical generation models behind the same public API.
3. Species and archetypes defined primarily through YAML rather than hardcoded JavaScript.
4. Deterministic variation from seeds.
5. Support for broadleaf trees, conifers, palms, shrubs, bonsai-like forms, weeping trees, mangrove-like structures, deadwood and future plant classes.
6. Perceptually stable LOD transitions from hero geometry to far impostors.
7. Forest-scale rendering using bounded reusable variant pools instead of one unique heavy mesh per tree.
8. Independent geometry, foliage, shadow and animation LOD.
9. Strong batching and instancing.
10. Generation that can respond to age, health, light, gravity, slope, competition and environmental constraints.
11. Runtime and offline compilation paths using the same canonical data model.
12. QA gates for topology, silhouette, canopy coverage, manifold structure, LOD continuity, deterministic output, memory and frame cost.
13. A renderer-independent architecture that can continue using the existing Three.js renderer while leaving room for a future WebGPU backend.
14. No reduction in visual quality as a default optimization strategy.
15. A path toward extremely large forests without requiring extremely large numbers of unique resources.

---

## Design Principles

### KISS

Each subsystem should do one clear job. Tree biology, representation compilation, runtime LOD, animation and rendering should not be mixed into one generator.

### SOLID

Generation models must be replaceable. Renderers must consume a stable tree representation rather than knowing how a tree was generated. Runtime systems must depend on contracts rather than species-specific implementations.

### YAGNI

Do not implement a complete plant biology simulator before it is needed. Add botanical behavior only when it materially improves visible structure, species coverage or environmental response.

### Determinism first

A seed and a validated configuration must reproduce the same logical tree. Determinism enables caching, QA, variant pools, multiplayer/world reproducibility and stable debugging.

### Quality is perceptual

LOD should preserve visual information in this order:

1. silhouette,
2. crown volume,
3. major branch structure,
4. foliage density,
5. lighting response,
6. motion,
7. individual leaf detail.

Triangle reduction is a tool, not the goal.

### Hero trees and forests are different workloads

A hero tree may justify richer unique geometry. A forest must aggressively reuse compiled assets and batch work. The architecture must support both rather than compromising both into one solution.

---

## Current Foundation

The repository already contains several systems that should become permanent foundations of the universal generator:

- deterministic seeded procedural generation,
- crown and lobe based structure generation,
- trunk and branch generation,
- procedural leaf-card silhouettes,
- instanced foliage shell rendering,
- canopy continuity and coverage certification,
- coverage-aware foliage reduction,
- hero leaf clusters,
- screen-space LOD selection,
- LOD hysteresis and cross-fading,
- deferred hero generation,
- branch and crown shadow proxies,
- tree impostor rendering,
- batched impostor atlases,
- frame-budgeted generation,
- manifold QA,
- canopy solidity QA,
- crown/shape QA,
- stress rendering QA,
- YAML-backed tuning,
- manual GitHub Pages deployment.

The first architectural migration is already complete:

- `TreeGenerator` is now a generation-model dispatcher.
- the existing implementation is isolated behind `CrownLobeTreeGenerator`.
- `generationModel` can be carried by presets.
- the default remains `crown-lobe`, preserving existing behavior.

This means the next botanical model can be introduced without turning the existing generator into a large tree-type switch statement.

---

# Target Architecture

```text
Species / Archetype YAML
        |
        +-- morphology
        +-- growth traits
        +-- foliage traits
        +-- environmental response
        +-- material family
        +-- runtime quality policy
        |
        v
Generation Model
        |
        v
Canonical Tree IR
        |
        +-- trunk graph
        +-- branch graph
        +-- attachment frames
        +-- foliage sites
        +-- foliage primitives
        +-- wind hierarchy
        +-- bounds / importance
        +-- metadata
        |
        v
Representation Compiler
        |
        +-- Hero representation
        +-- Near assembly representation
        +-- Mid aggregate representation
        +-- Far impostor representation
        +-- Shadow representation
        |
        v
Runtime Vegetation System
        |
        +-- screen-space LOD
        +-- culling
        +-- streaming
        +-- batching
        +-- variant reuse
        +-- animation LOD
        +-- budget enforcement
        |
        v
Three.js renderer today
WebGPU-capable backend later
```

---

# Canonical Tree IR

## Objective

Introduce one stable intermediate representation, or Tree IR, that all botanical generators produce and all representation compilers consume.

This is the most important architectural step in the roadmap.

Without a Tree IR, every new species family will leak special cases into rendering, LOD, shadows, wind, QA and tooling.

## Required IR responsibilities

The Tree IR should describe the logical tree, not a specific GPU representation.

Recommended top-level structure:

```js
{
  schemaVersion,
  presetId,
  generationModel,
  seed,
  height,
  bounds,
  root,
  stems,
  foliageSites,
  foliageGroups,
  windNodes,
  crownVolumes,
  metadata
}
```

## Stem graph

Every woody structure should be represented as graph nodes or stem records containing at least:

- stable ID,
- parent ID,
- botanical order,
- attachment position,
- attachment orientation/frame,
- path or control points,
- start radius,
- end radius,
- taper properties,
- exposed tip state,
- growth age or maturity,
- structural importance,
- wind parent.

The current trunk and branches can be mapped into this structure without altering appearance.

## Attachment frames

XYZ attachment points are insufficient for universal foliage.

Each attachment should eventually provide a local coordinate frame:

- position,
- tangent,
- normal,
- binormal or equivalent quaternion.

This allows leaves, needles, fronds, cones, flowers and sub-branches to orient consistently without reconstructing orientation later.

## Foliage sites

A foliage site represents where foliage can grow.

It should contain:

- ID,
- parent stem ID,
- position/frame,
- normalized branch position,
- exposure,
- age,
- vigor,
- light factor,
- density potential,
- primitive family,
- importance.

## Foliage primitive families

The IR should support logical primitive types such as:

- broadleaf,
- needle cluster,
- frond,
- compound leaf,
- spray,
- generic cluster,
- flower/fruit attachment point,
- no foliage / deadwood.

The renderer decides whether that primitive becomes real geometry, a card, a cluster assembly or an aggregate proxy.

## Crown volumes

The current lobe representation remains useful as a generalized crown-volume representation.

The Tree IR should therefore allow zero or more crown volumes describing:

- center,
- orientation,
- scale/radius,
- local density,
- exposure,
- source branch,
- macro clump,
- color mix,
- continuity metadata.

Some models may produce many crown volumes. Others may produce very few or none.

## Wind hierarchy

Wind relationships should be precomputed into logical nodes:

- trunk sway node,
- primary branch node,
- secondary branch node,
- twig/foliage node,
- local phase,
- stiffness,
- damping,
- mass/area proxy.

This allows animation LOD to collapse child nodes into parents without changing the botanical generator.

## Schema versioning

The IR must carry a schema version from day one.

Rules:

- additions should prefer backwards-compatible optional fields,
- breaking changes increment the schema,
- representation caches include the schema version,
- QA fixtures should include known IR snapshots.

---

# Generation Model Architecture

## Public contract

Each generation model should follow one small interface:

```js
class ExampleTreeGenerator {
  generate(preset, seed, options) {
    return treeIr;
  }
}
```

Models must not create Three.js meshes.

Models must not decide runtime LOD.

Models must not know about camera distance.

They should produce deterministic logical vegetation.

## Initial model families

### 1. crown-lobe

Status: existing model.

Use for:

- current fluffy broadleaf trees,
- bushes,
- stylized crowns,
- bonsai-like pad structures.

It should remain supported indefinitely unless a later model fully supersedes it with no regression.

### 2. whorled-conifer

Recommended first genuinely new model.

Supports:

- pine,
- spruce,
- fir,
- cedar-like forms,
- stylized conifers.

Core behavior:

- dominant leader,
- vertical internodes,
- branch whorls,
- age-dependent branch length,
- branch sag,
- apical taper,
- lower-branch mortality option,
- needle foliage attached to branch/twig regions,
- directional crown asymmetry.

This model proves that the architecture supports a fundamentally different topology rather than another crown preset.

### 3. sympodial-broadleaf

For oak-like and mature spreading trees.

Core behavior:

- weaker apical dominance,
- competing leaders,
- branching-angle distribution,
- branch thickening by supported mass,
- crown self-organization,
- asymmetric light response.

### 4. excurrent-broadleaf

For trees that preserve a stronger central leader than spreading oaks.

### 5. palm

Requires a different structure:

- mostly unbranched trunk,
- crown attachment ring,
- frond emergence order,
- frond droop,
- old-frond removal,
- optional trunk scars.

This is a strong architecture test because palm morphology does not map naturally to the current lobe/branch assumptions.

### 6. shrub

Multi-stem base, compact crown and high stem count.

### 7. weeping

Introduces gravity-biased child growth and hanging foliage.

### 8. mangrove / root-specialized

Future model or extension providing aerial/support root systems.

### 9. deadwood

Woody structure with no or partial foliage, broken tips and optional snag generation.

---

# Species and Archetype Configuration

## Goal

Species should be data-driven wherever practical.

A species configuration should select a generation model and provide biological/artistic ranges.

Example direction:

```yaml
species:
  stonePine:
    generationModel: whorled-conifer
    morphology:
      height: [10, 22]
      trunkRadius: [0.25, 0.65]
      apicalDominance: 0.9
      whorlSpacing: [0.45, 0.8]
      branchAngle: [0.65, 1.05]
      lowerBranchMortality: 0.25
    foliage:
      primitive: needle
      density: 0.78
    variation:
      crownAsymmetry: 0.18
      trunkLean: 0.08
```

The exact schema should evolve incrementally and remain validated.

## Separate concerns

Do not mix all properties into one flat preset.

Long term, distinguish:

- morphology,
- foliage,
- material,
- environment,
- variation,
- quality policy.

## Archetype inheritance

Potential later capability:

```text
conifer-base
    -> pine-base
        -> stone-pine
        -> maritime-pine
```

Do not implement inheritance until enough duplication exists to justify it.

---

# Botanical Growth Traits

These traits should be introduced progressively rather than all at once.

## Structural traits

- apical dominance,
- branch probability,
- child count distribution,
- branching angle,
- azimuth/phyllotaxis,
- internode length,
- length decay,
- radius decay,
- taper,
- branch droop,
- gravitropism,
- phototropism,
- trunk lean,
- trunk curvature,
- branch gnarl,
- branch twist,
- branch mortality,
- maximum generation depth.

## Crown traits

- crown base height,
- crown height,
- crown radius,
- density envelope,
- asymmetry,
- clump size,
- clump separation,
- silhouette breakup,
- interior voids,
- lower-crown mortality,
- crown competition response.

## Foliage traits

- primitive family,
- scale,
- density,
- attachment density,
- orientation distribution,
- droop,
- clustering,
- leaf/needle age,
- color gradient,
- seasonal state,
- exposure response,
- interior thinning.

---

# Environment-Aware Generation

The generator should eventually accept an environmental context in addition to preset and seed.

Example:

```js
{
  lightDirection,
  lightAvailability,
  slopeNormal,
  prevailingWind,
  competitionVolumes,
  obstacleVolumes,
  moisture,
  age,
  health
}
```

## Light response

Branches and crown density may bias toward available light.

Keep this deterministic by deriving all decisions from the original seed and stable context values.

## Competition

Nearby crown volumes can suppress or redirect growth.

This enables believable forest edges and neighboring tree interaction without simulating full biology.

## Slope and gravity

Root base, trunk lean and branch droop can respond to terrain normal.

## Prevailing wind

Long-term growth asymmetry can be distinct from real-time wind animation.

## Obstacles

Optional building/rock volumes can steer or prune growth for authored scenes.

---

# Representation Compiler

## Purpose

The botanical generator should create one logical tree. A separate compiler converts that tree into representations optimized for different screen sizes and platforms.

This is central to AAA performance.

## Representation classes

### Hero representation

Use when the tree occupies a large part of the screen.

Possible content:

- highest branch topology,
- high radial trunk resolution,
- hero leaves or true foliage geometry,
- local foliage clusters,
- detailed bark shading,
- highest wind hierarchy,
- optional fruits/flowers.

### Near assembly representation

Goal: maintain nearly identical silhouette and depth while reducing unique geometry.

Use reusable components where possible:

- branch/twig assemblies,
- foliage clusters,
- leaf meshes,
- needle assemblies.

The same component geometry should be instanced many times.

### Mid aggregate representation

Current foliage cores and shell cards are a strong basis.

Generalize them into aggregate crown representations that preserve:

- crown silhouette,
- approximate depth,
- lighting volume,
- coverage,
- major branch visibility.

### Far impostor representation

Continue using impostors, but evolve toward:

- bounded atlas pools,
- controlled view counts,
- cached variant captures,
- shared atlas pages,
- possibly precompiled species/variant impostors,
- stable cross-fades from aggregate geometry.

### Cull representation

Trees below the configured projected-size threshold should produce no color work and ideally no per-tree expensive CPU work.

---

# Variant Pool Architecture

## Problem

A procedural system can theoretically produce a unique tree for every seed. Rendering a unique fully compiled mesh for every tree is not suitable for massive forests.

## Solution

Separate logical variation from compiled geometry variation.

For forest use, create a bounded deterministic variant pool per species/archetype.

Example:

```text
stonePine
  variant 0
  variant 1
  variant 2
  ...
  variant 31
```

World tree instances map to variants deterministically.

## Instance-level variation

Uniqueness can still come from cheap per-instance parameters:

- rotation,
- scale,
- color offset,
- seasonal state,
- wind phase,
- wind amplitude,
- minor crown warp,
- foliage density scalar,
- health scalar,
- ground alignment,
- deterministic material variation.

## Hero override

Important or close trees can still receive unique generation/compilation.

## Pool sizing

Pool size should be configurable by platform/scene budget.

Potential starting values for testing, not hard requirements:

- background species: 4-8 variants,
- normal forest species: 8-32 variants,
- highly visible species: 16-64 variants,
- hero specimens: unique.

Actual values must be driven by memory and repetition QA rather than assumptions.

---

# Geometry Strategy

## Current issue to address

The current branch renderer creates branch geometries and merges them into one unique structure mesh per tree. This is appropriate for a small number of high-quality trees but cannot be the only forest strategy.

## Hero path

Keep high-quality merged procedural geometry available for hero trees.

## Forest path

Investigate reusable branch/twig assemblies and variant compilation.

Potential approaches:

1. compile complete variant meshes once and instance entire variants,
2. instance reusable branch assemblies inside a variant,
3. hybrid approach where trunk is unique per variant and fine twigs are repeated assemblies.

Prefer the simplest approach that reaches the draw-call and visual targets.

## Geometry caches

Cache geometry by immutable compile key containing inputs such as:

- IR schema version,
- species/preset revision,
- seed or variant ID,
- representation level,
- quality profile,
- structural compile options.

---

# Foliage Strategy

## Universal foliage pipeline

The current foliage shell system should become one backend among several foliage representations.

Required families:

- real leaf meshes,
- leaf-card sprays,
- needle assemblies,
- frond geometry,
- crown aggregate shells,
- core volume proxies,
- impostors.

## Alpha coverage

The existing coverage certification is valuable and must be retained.

LOD foliage reduction must continue protecting certified repair instances so that lower LOD does not reintroduce visible holes.

## Leaf/card density selection

Selection should continue to prioritize distribution and perceptual coverage rather than random percentage removal.

## Interior foliage

Interior foliage should be generated only when it materially contributes to depth, shadowing or close-view realism.

It should become aggressively cheaper with screen size.

## Species-dependent coverage

A conifer should not be forced to satisfy exactly the same visual density policy as a dense round broadleaf crown.

Coverage QA must evolve from one global standard toward foliage-family-aware policies while still preventing accidental holes.

---

# LOD Architecture

## Replace positional assumptions

The current runtime has several concepts tied to fixed indices such as LOD 0-3.

Move toward semantic representation roles:

```text
hero
near
aggregate
impostor
culled
```

The runtime may still store these in arrays internally, but policies should refer to roles rather than magic indices.

## Screen-space selection

Continue using projected screen size rather than fixed world distance.

Benefits:

- naturally handles tree height,
- camera FOV,
- viewport resolution,
- large and small species.

## Hysteresis

Retain hysteresis to avoid rapid transitions.

## Transition strategy

Transitions must preserve silhouette and coverage.

Use controlled dither/crossfade where required.

## Per-representation thresholds

Different species may require different thresholds.

A thin palm and a dense oak can fail visually at different projected sizes.

Support defaults plus optional species quality overrides.

---

# Independent Animation LOD

Geometry LOD and animation LOD should not be the same decision.

Recommended animation hierarchy:

### Hero

- trunk sway,
- primary branches,
- secondary branches,
- twigs,
- leaf/frond flutter.

### Near

- trunk,
- primary branches,
- reduced secondary motion,
- cluster/leaf phase animation.

### Medium

- trunk and primary branch motion only.

### Far

- one or a few whole-tree deformation modes.

### Impostor

- very cheap sway, phase offset or static representation depending on budget.

## Wind importance

Motion should scale with:

- screen size,
- branch order,
- branch stiffness,
- exposed area,
- local wind factor.

## Animation budget

The runtime should be able to cap the number of trees receiving expensive branch-level animation each frame.

---

# Runtime Forest System

The current demo owns individual tree roots. The universal system should add a forest-level runtime layer.

## Responsibilities

- spatial registration,
- frustum culling,
- optional occlusion strategy,
- screen-space importance,
- LOD assignment,
- variant lookup,
- instance batching,
- animation budget,
- shadow budget,
- streaming/prewarming,
- world-origin-safe transforms if future world scale requires it.

## Spatial partition

Introduce only when tree count justifies it.

Candidates:

- uniform grid,
- loose grid/chunks,
- quadtree.

A grid/chunk solution should be preferred initially because it is simple and maps naturally to world streaming.

## Chunk lifecycle

Potential states:

```text
unloaded
metadata-only
impostor-ready
aggregate-ready
near-ready
hero-ready
```

Transitions should obey frame budgets.

---

# Generation Scheduling

The existing frame-budget queue is a useful start.

Extend generation/compilation scheduling with priorities based on:

1. visible and approaching camera,
2. projected screen size,
3. missing representation urgency,
4. shadow importance,
5. requested studio/editor work.

Tasks should be cancelable or skippable when a tree/chunk leaves relevance before expensive work begins.

## Avoid main-thread spikes

Long-term options:

- split compilation into small tasks,
- use Web Workers for CPU-only deterministic generation,
- transfer typed arrays rather than Three.js objects,
- build GPU objects on the render thread only when necessary.

Workers should be added after the Tree IR is serializable and stable.

---

# Caching Strategy

## Logical generation cache

Cache Tree IR by deterministic key:

```text
model + preset revision + seed + environment signature + schema version
```

## Representation cache

Cache compiled representations separately:

```text
tree IR hash + representation role + quality profile + compiler version
```

## Foliage texture cache

Share palette and alpha resources whenever inputs are identical.

## Geometry cache

Never rebuild immutable geometry if an equivalent compiled asset already exists.

## Impostor cache

Avoid recapturing the same species variant and rotation policy repeatedly.

## Cache ownership

Resources must have explicit ownership/ref-count or lifecycle rules so rebuilding scenes does not leak GPU resources.

---

# Memory Strategy

AAA performance is not only frame time.

Track at least:

- geometry bytes,
- texture bytes,
- instance-buffer bytes,
- atlas bytes,
- Tree IR memory,
- compiled variant count,
- live hero count,
- live aggregate count,
- impostor atlas count.

Introduce soft budgets per quality profile.

When a budget is exceeded, degrade the least perceptually important representation first rather than unpredictably allocating more memory.

---

# Shadow Strategy

Shadows should have their own quality policy.

## Near

Detailed structure plus foliage proxy where justified.

## Medium

Simplified trunk/major branches and crown proxy.

## Far

No dynamic shadow or extremely cheap aggregate shadow depending on scene requirements.

## Budget control

Prioritize shadows by projected size and camera/light relevance.

Avoid enabling expensive shadows merely because the color representation is high detail.

---

# Materials and Lighting

## Shared materials

Species should share material programs whenever possible.

Variation should use textures, uniforms or instance attributes rather than creating a unique material instance per tree.

## Bark

Move toward reusable bark families with per-instance variation.

Potential inputs:

- palette,
- roughness,
- vertical variation,
- age,
- moisture/darkening,
- trunk scale.

## Foliage

Maintain support for:

- palette variation,
- exposure response,
- crown normals,
- sky contribution,
- cavity contribution,
- translucency approximation,
- season/health variation.

Avoid expensive shader branches that vary by individual species where a data-driven parameter can achieve the same result.

---

# Optional Seasonal and Health Systems

These should be layered over a stable universal generator, not block the core migration.

Possible states:

- spring,
- summer,
- autumn,
- winter,
- healthy,
- dry,
- stressed,
- dead.

The logical tree can remain structurally stable while foliage density, color, shedding and dead branches vary.

Deciduous winter should be able to compile into a branch-dominant representation rather than an empty version of a foliage-heavy mesh.

---

# Authoring and Tooling

## Studio mode

The current tuning studio should evolve into a species/generation-model editor.

Useful controls:

- generation model,
- seed,
- age,
- morphology traits,
- foliage family,
- branch traits,
- environment preview,
- LOD role preview,
- wind level preview,
- performance metrics.

## Debug overlays

Add optional overlays for:

- branch order,
- stem graph,
- crown volumes,
- foliage sites,
- wind hierarchy,
- active LOD role,
- projected pixels,
- variant ID,
- draw-call batch,
- shadow state,
- coverage repair cards,
- bounding volumes.

Debug UI must remain disabled for normal QA captures unless explicitly requested.

---

# Performance Instrumentation

A universal system needs measurable budgets.

## Per-tree metrics

Track:

- logical stem count,
- branch count,
- foliage site count,
- foliage instance count,
- triangles by representation,
- draw calls by representation,
- generation time,
- compile time,
- memory estimate.

## Scene metrics

Track:

- visible trees,
- culled trees,
- trees by LOD role,
- batched draw calls,
- triangles,
- generation queue length,
- representation cache hit rate,
- impostor atlas count,
- active high-detail wind count,
- dynamic shadow caster count.

## Frame budgets

Use configurable budgets rather than hardcoded target numbers.

Potential profiles:

- low,
- medium,
- high,
- ultra,
- cinematic/editor.

The initial implementation can use one profile and add more only after metrics exist.

---

# QA Strategy

Existing QA must remain and expand.

## Determinism QA

Verify:

- same input produces identical Tree IR,
- same input produces stable representation metadata,
- variant assignment is deterministic,
- environment context changes only expected outputs.

## Schema QA

Validate:

- presets,
- generation model IDs,
- Tree IR schema,
- representation compile inputs,
- runtime quality profiles.

## Topology QA

Verify:

- all parents exist,
- no illegal cycles,
- branch orders are valid,
- radii do not become invalid,
- attachment positions are finite,
- foliage references valid stems.

## Geometry QA

Retain manifold checks where applicable.

Add:

- invalid normals,
- NaNs/infinities,
- degenerate geometry limits,
- bounds correctness.

## Canopy QA

Retain coverage and solidity gates.

Extend to foliage-family-specific thresholds.

## LOD QA

For every supported model/species:

- no missing representation,
- silhouette error within policy,
- canopy coverage within policy,
- transition does not expose large holes,
- impostor scale matches aggregate geometry,
- transition ordering is stable under hysteresis.

## Stress QA

Expand from dozens of trees toward staged targets:

- 100 trees,
- 1,000 logical trees,
- 10,000 forest instances,
- larger counts once variant batching exists.

The test does not need every tree at hero LOD. It should represent realistic mixed LOD populations.

## Memory QA

Detect unbounded resource growth after repeated rebuilds, reseeds and camera traversal.

## Visual regression

Where practical, retain representative screenshots for:

- broadleaf,
- conifer,
- palm,
- shrub,
- sparse/dead tree,
- near/mid/far LOD transition cases.

---

# Phased Implementation Plan

## Phase 0 - Architectural preparation

Status: IN PROGRESS / partially complete.

### Completed

- isolate current generator as `CrownLobeTreeGenerator`,
- make `TreeGenerator` dispatch generation models,
- preserve `crown-lobe` as default,
- support `generationModel` in preset-library round trips,
- add generation-model tests.

### Remaining

- document stable generation-model contract,
- add generation model ID to generated tree metadata consistently,
- remove any renderer assumptions that generation can only be crown/lobe based.

### Acceptance criteria

- current rendered presets show no intentional visual change,
- deterministic tests still pass,
- unsupported models fail clearly,
- new models can be registered without modifying `TreeGenerator`.

---

## Phase 1 - Canonical Tree IR

Priority: CRITICAL.

### Tasks

- define `TreeIr` schema and constants,
- add `schemaVersion`,
- define stem records,
- define attachment frames,
- define crown-volume records,
- define foliage-site records,
- define wind-node records,
- add IR validator,
- add IR deterministic fixtures,
- adapt crown-lobe generator to emit Tree IR,
- provide compatibility adapter for current renderers during migration.

### Migration rule

Do not rewrite all rendering simultaneously.

Add an adapter from Tree IR to the current tree-data shape first. This reduces regression risk.

### Acceptance criteria

- existing broadleaf presets render equivalently through IR,
- no renderer needs direct access to the old generator implementation,
- Tree IR contains no Three.js objects,
- Tree IR is serializable,
- Tree IR validation is covered by tests.

---

## Phase 2 - Semantic representation roles

Priority: HIGH.

### Tasks

- introduce semantic role IDs,
- map existing LOD 0-3 to roles,
- remove magic `index === 3` style assumptions,
- update LOD metrics to report role names,
- keep array indexing only as an implementation detail,
- make shadow policy independent.

### Acceptance criteria

- existing behavior is visually unchanged,
- LOD controller refers to representation metadata rather than fixed semantics encoded by index,
- a future species can omit or replace a role if policy allows it.

---

## Phase 3 - First universal proof: whorled conifer

Priority: HIGH.

### Tasks

- implement deterministic leader growth,
- generate internodes,
- generate branch whorls,
- age branch length by vertical position,
- support branch sag,
- support crown taper,
- generate needle foliage sites,
- map needle sites to existing card/aggregate rendering initially,
- create at least two conifer species presets,
- add conifer QA fixtures.

### Acceptance criteria

- conifers are structurally generated by a separate model,
- no conifer-specific branch exists inside `TreeGenerator`,
- renderer consumes the same Tree IR contract,
- close silhouette clearly reads as conifer rather than a reshaped broadleaf crown,
- LOD and impostor transitions pass QA.

---

## Phase 4 - Foliage primitive abstraction

Priority: HIGH.

### Tasks

- define foliage primitive family IDs,
- separate logical foliage site from rendered card instance,
- implement broadleaf backend,
- implement needle backend,
- prepare frond interface,
- keep coverage-aware reduction,
- move leaf-shape selection under foliage family policy.

### Acceptance criteria

- Tree IR does not assume every foliage site becomes a shell card,
- broadleaf quality does not regress,
- conifer needles use a dedicated logical path,
- foliage compiler can choose backend by family and LOD role.

---

## Phase 5 - Representation compiler and caches

Priority: CRITICAL for large worlds.

### Tasks

- introduce representation compiler service,
- define compile keys,
- cache immutable compiled assets,
- separate Tree IR cache and representation cache,
- reuse textures/material programs,
- expose compile metrics,
- implement resource lifecycle ownership.

### Acceptance criteria

- rebuilding an equivalent tree does not rebuild equivalent immutable resources unnecessarily,
- caches remain bounded/configurable,
- repeated scene rebuilds do not leak GPU resources,
- cache hits are visible in metrics.

---

## Phase 6 - Forest variant pool

Priority: CRITICAL for AAA-scale density.

### Tasks

- add `SpeciesVariantPool`,
- deterministic world-instance-to-variant mapping,
- compile bounded variants,
- whole-tree instancing for reusable representations,
- preserve unique hero override,
- add per-instance color/wind/scale variation,
- repetition QA.

### Acceptance criteria

- thousands of world trees can reference tens of compiled variants,
- visual repetition remains acceptable under defined QA scenes,
- far and mid forest draw calls scale primarily with batches, not tree count,
- hero specimens remain possible.

---

## Phase 7 - Forest runtime manager

Priority: HIGH.

### Tasks

- add chunk/grid spatial management,
- visibility candidate gathering,
- projected-size importance,
- representation assignment,
- generation prewarming,
- queued upgrades/downgrades,
- cancellation/stale-task protection,
- chunk lifecycle.

### Acceptance criteria

- tree count can grow substantially without linear expensive per-frame work across every world tree,
- camera movement does not cause generation spikes beyond configured budget,
- hidden/unloaded chunks release appropriate resources.

---

## Phase 8 - Animation hierarchy and animation LOD

Priority: HIGH after forest batching.

### Tasks

- generate logical wind hierarchy,
- define stiffness and phase data,
- hero branch animation,
- collapsed near/medium modes,
- cheap far sway,
- cap expensive animated tree count,
- add wind QA scenes.

### Acceptance criteria

- animation complexity decreases independently of geometry,
- nearby trees have convincing hierarchical motion,
- large forests do not run full twig-level animation,
- transitions between animation detail levels are not distracting.

---

## Phase 9 - Palm and frond model

Priority: HIGH as second architecture proof.

### Tasks

- implement palm generator,
- trunk ring/scar data,
- crown/frond attachment system,
- frond primitive/backend,
- frond droop and wind hierarchy,
- palm aggregate representation,
- palm impostor validation.

### Acceptance criteria

- palm uses the same public generation and runtime architecture,
- no lobe workaround is required for its primary structure,
- fronds preserve silhouette through LOD transitions.

---

## Phase 10 - Environment-aware growth

Priority: MEDIUM.

### Tasks

- define environment context contract,
- add slope/gravity response,
- add deterministic light bias,
- add prevailing-wind growth bias,
- add basic crown competition volumes,
- add obstacle/pruning hook.

### Acceptance criteria

- environmental inputs produce deterministic structure changes,
- identical inputs remain reproducible,
- environmental logic is optional and does not complicate basic preset generation.

---

## Phase 11 - Advanced broadleaf growth

Priority: MEDIUM.

### Tasks

- sympodial broadleaf model,
- multiple leaders,
- mature branch hierarchy,
- crown self-organization,
- optional lower-limb loss,
- stronger environmental response.

### Acceptance criteria

- mature spreading trees are not dependent on the old lobe model for topology,
- oak-like silhouettes can be produced through growth parameters.

---

## Phase 12 - Worker generation

Priority: MEDIUM and only after Tree IR stability.

### Tasks

- move pure generation into workers,
- serialize presets/context,
- return typed/structured IR,
- introduce worker pool,
- priority queue integration,
- cancellation/version checks.

### Acceptance criteria

- heavy generation no longer produces large main-thread stalls,
- no Three.js objects cross worker boundaries,
- deterministic output matches single-thread mode.

---

## Phase 13 - WebGPU experimental backend

Priority: OPTIONAL / FUTURE.

Do not block the core architecture on WebGPU.

### Candidate work

- GPU visibility evaluation,
- GPU LOD classification,
- compacted instance lists,
- compute-assisted wind,
- compute foliage placement for selected workflows,
- indirect-style rendering where supported cleanly.

### Acceptance criteria

- WebGPU path demonstrates measurable benefit,
- existing WebGL-compatible path remains functional until WebGPU reliability and browser support justify a stronger migration.

---

# Recommended Implementation Order

The shortest path from the current repo to a genuinely universal system is:

```text
Generation model interface            DONE
        |
        v
Canonical Tree IR
        |
        v
Semantic representation roles
        |
        v
Whorled conifer
        |
        v
Foliage primitive abstraction
        |
        v
Representation compiler/cache
        |
        v
Variant pool
        |
        v
Forest runtime manager
        |
        v
Animation LOD
        |
        v
Palm/fronds
        |
        v
Environment-aware growth
        |
        v
Advanced botanical models
        |
        v
Workers / optional WebGPU
```

This order deliberately proves universality before spending significant effort on extreme forest scale.

---

# Production Acceptance Definition

The system should not be called universal/AAA-ready merely because it has many presets.

A production-quality milestone should satisfy the following.

## Architecture

- at least three fundamentally different generation models,
- common Tree IR,
- common representation compiler,
- no central species switch statement,
- YAML-driven species configuration,
- semantic representation roles.

## Visual coverage

At minimum:

- spreading broadleaf,
- columnar/upright broadleaf,
- conifer,
- palm,
- shrub,
- sparse/dead tree.

## Runtime

- bounded variant pools,
- instanced forest representations,
- batched far impostors,
- screen-space LOD,
- independent shadow budget,
- independent animation LOD,
- frame-budgeted upgrades,
- memory-aware caches.

## Quality

- deterministic QA,
- topology QA,
- manifold QA where relevant,
- foliage continuity QA,
- LOD transition QA,
- stress QA,
- resource leak QA,
- visual regression scenes.

## Tooling

- species editor/tuning support,
- representation preview,
- debug overlays,
- runtime metrics.

---

# Performance Priorities

When optimizing, prefer changes in this order:

1. eliminate unnecessary work,
2. reuse immutable work,
3. batch repeated work,
4. reduce update frequency,
5. reduce data bandwidth,
6. reduce geometry that does not affect perception,
7. reduce shader complexity that does not affect perception,
8. only then lower visible quality if a strict target cannot otherwise be met.

Specific high-value targets:

- avoid regenerating identical variants,
- avoid recapturing identical impostors,
- avoid unique material programs per tree,
- avoid per-frame updates for static trees,
- avoid full-world LOD evaluation when spatial chunks can reject most trees,
- avoid hero construction until projected size requires it,
- avoid high-order branch shadows at distance,
- avoid full branch wind at distance,
- share foliage and branch assembly resources,
- keep far tree draw calls proportional to batches instead of individual trees.

---

# Explicit Non-Goals

Unless future requirements justify them, do not make these immediate goals:

- full scientific tree physiology simulation,
- physically exact hormone transport,
- physically exact fluid-structure wind simulation,
- runtime growth over years,
- destructive branch fracture physics for every tree,
- unique high-resolution mesh for every forest tree,
- rewriting the entire renderer around WebGPU before the architecture is stable.

The goal is visually believable, deterministic and scalable procedural vegetation, not academic plant simulation.

---

# Risks and Mitigations

## Risk: architecture rewrite causes visual regression

Mitigation:

- migrate through adapters,
- preserve old `crown-lobe` output,
- keep existing QA active,
- change one subsystem at a time.

## Risk: too much biological complexity

Mitigation:

- introduce only traits that create visible value,
- keep models small and composable,
- prefer artistic controls over hidden complexity.

## Risk: procedural uniqueness destroys batching

Mitigation:

- variant pools,
- hero overrides,
- cheap per-instance variation.

## Risk: aggressive LOD reintroduces canopy holes

Mitigation:

- keep coverage certification,
- maintain coverage-aware instance selection,
- compare actual rendered representation, not only source foliage count.

## Risk: impostor memory grows unbounded

Mitigation:

- fixed atlas policies,
- variant-level reuse,
- cache eviction,
- avoid per-world-instance captures.

## Risk: CPU generation stalls

Mitigation:

- frame budgeting first,
- caching second,
- workers after stable serializable IR.

## Risk: WebGPU churn

Mitigation:

- renderer-independent logical architecture,
- keep WebGPU experimental until it provides clear measurable value.

---

# Immediate Next Work

The next implementation slice should be Phase 1: Canonical Tree IR.

Recommended concrete sequence:

1. create Tree IR schema constants and validator,
2. map current trunk/branches/lobes/shell metadata into IR concepts,
3. add a compatibility adapter from IR to the existing renderer input,
4. make `CrownLobeTreeGenerator` return Tree IR,
5. run deterministic and existing QA through the adapter,
6. add generation model metadata to runtime diagnostics,
7. only after equivalence is established, begin the whorled-conifer model.

This sequence minimizes risk because visual rendering remains unchanged while the dependency direction is corrected.

---

# Definition of Success

The universal architecture is successful when adding a new species such as:

```yaml
species:
  coconutPalm:
    generationModel: palm
```

or:

```yaml
species:
  stonePine:
    generationModel: whorled-conifer
```

requires primarily:

- species configuration,
- the appropriate generation model if one does not already exist,
- foliage backend configuration if the primitive family is new,

and does **not** require modifying:

- `TreeGenerator`,
- the general runtime LOD controller,
- the forest manager,
- generic cache infrastructure,
- generic streaming infrastructure.

At that point the repository has stopped being a procedural fluffy-tree demo and has become a general procedural vegetation platform.
