# Docs index — glade upgrade

Review written 2026-08-06 from a full read of the generation/rendering pipeline, then
implemented and measured. Where measurement contradicted the plan, the plan documents
were corrected rather than quietly followed — those corrections are the most useful
part of this set.

1. **[code-review-tree-generator.md](code-review-tree-generator.md)** — findings ranked
   P0–P3 with file/line references. Read first.
2. **[plan-performance.md](plan-performance.md)** — six work items. §1, §2, §3, §6
   shipped; §4 (per-preset resource sharing) and §5 (variant pool + instancing) remain
   and are the largest forest-scale wins left.
3. **[plan-tiny-glade-look.md](plan-tiny-glade-look.md)** — shader terms, `puff` card,
   lighting values, post chain, set dressing. §1–§3 shipped; post chain and dressing
   remain.
4. **[preset-glade.md](preset-glade.md)** — the three glade presets, shipped and
   measured.
5. **[research-leaf-placement-and-culling.md](research-leaf-placement-and-culling.md)**
   — the hollow-crown illusion: ray taxonomy, covering theory, occlusion-cone culling,
   wind invariance, precomputation tiers, validation sweep.

## What shipped

| change | evidence |
|---|---|
| QA analyzers gated out of the render path | manifold analysis no longer runs 4× per tree |
| Shell selection made exact-but-fast | 2472 ms → 889 ms for one tree of each preset, identical output |
| Per-frame LOD path: no allocation, change-driven fades, forest striding | no per-frame arrays or scene-graph walks in `TreeLodController.update` |
| `puff` leaf card | guaranteed opaque radius 0.284 vs broadleaf 0.080 |
| Glade presets (`gladeCanopy`, `gladeBlossom`, `gladeBush`) | half the cards, half the build time, `hole=0.00000` |
| Three stylized light terms + retuned lighting | existing presets unchanged by construction (zero defaults) |
| Occlusion-cone card culling | **0 differing pixels** on/off; 0.3–11% of cards culled |
| `?wind=off` | renders bit-exact across runs, making A/B possible at all |

## Corrections worth reading

- **The covering-lattice rewrite was not shipped**, and should not be attempted as
  originally specified. Coverage is carried by the leaf blades' actual alpha, which
  reaches 3–4× past the guaranteed inscribed disc; pricing a lattice against the disc
  would have needed roughly ten times the cards.
  (`research-leaf-placement-and-culling.md` §2.1)
- **Back-face culling saves far less than estimated** — 0.3–11% depending on crown
  shape, not 15–25%, because the conservative occluder is the sphere inscribed in the
  core and flattened pad crowns have almost none. (§3.2)
- **Candidate counts were the wrong lever.** `columnar` runs 28,800 candidates faster
  than `bonsaiInformal` runs 11,200; the cost was in the greedy's coverage queries.
  (`plan-performance.md` §1)

## Recommended next steps

§4 resource sharing, then §5 variant pool — together they are what takes the forest
scene from hundreds of draw calls to roughly a hundred. Then the post chain (look §4)
and set dressing (look §5), which are the remaining visual distance to the reference.
The pre-existing LOD2–LOD3 crossfade holes on `bonsaiLiterati`, `bonsaiInformal`,
`irregularAutumn` and `autumnBush` are untouched by this work and still open.
