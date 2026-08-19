# Glade presets — exact configuration

> **Shipped.** All three are in `config/tree-presets.yaml`, with solidity thresholds in
> `config/canopy-solidity-qa.yaml` and three of them placed in the garden layout. The
> `# NEW` fields below are live, validated in `src/domain/tree-preset.js`, and
> `leafShape: puff` exists. Measured against the gate:
>
> | preset | cards | generation | worst-view hole ratio |
> |---|---|---|---|
> | gladeCanopy | 1075 | 27.7 ms | 0.00000 |
> | gladeBlossom | ~1096 | 29.2 ms | 0.00000 |
> | gladeBush | 672 | 9.9 ms | 0.00000 |
> | *roundOrchard (for scale)* | *2117* | *56.7 ms* | *0.00000* |
>
> Half the cards and half the build time of the nearest existing preset, with no
> see-through anywhere in the sweep.

Two new presets for `config/tree-presets.yaml`: `gladeCanopy` (the big pastel round tree)
and `gladeBush` (low puffy shrub). Values are chosen to pass every validator in
`src/domain/tree-preset.js` and to stay **cheaper than the existing presets**
(fewer lobes, fewer shell candidates, branching depth 2, larger cards → fewer of them).

Fields marked `# NEW` require the shader work in `plan-tiny-glade-look.md` §1 (they pass
through validation as extra keys but do nothing until the uniforms exist). `leafShape:
puff` requires §2 — use `broadleaf` until then.

## Design intent → parameter mapping

| Tiny Glade trait | parameter choice |
|---|---|
| few big soft puffs | `lobeCount 10`, `lobeScale [0.86, 1.08]`, `lobeScaleMultiplier 1.55`, `surfaceTension 0.8`, `clumps.macroCount 3`, `silhouetteBreakup 0.1` |
| pale sunlit tops, wide value range | `heightPaletteShift 0.26`, `heightLightStrength 0.2`, palette ending near-cream |
| cool luminous underside | `undersideTint/Strength` (new), `skyLightStrength 0.3`, `core.brightness 0.62`, `cavityStrength 0.22` |
| soft wrap of sun across the puff | `wrapLight 0.72`, `crownNormalBlend 0.68`, `radialNormalStrength 0.88` |
| clean silhouette, no twiggy noise | `exposedTipRatio 0.12`, `branching.depth 2`, `noiseAmplitude 0.035`, `surfaceBreakup 0.02` (new) |
| scalloped card edges | `leafShape: puff`, `alphaTest 0.4` (alpha-to-coverage feathers it) |
| chunky short trunk | `height 7.4` with `crown.height 4.6`, `baseRadius 0.42`, `flare 0.5` |

## `gladeCanopy`

```yaml
  gladeCanopy:
    label: Glade canopy
    height: 7.4
    crown:
      profile: round
      baseHeight: 2.4
      height: 4.6
      radius: 3.0
      lobeCount: 10
      lobeScale: [0.86, 1.08]
      verticalScale: [0.84, 1.04]
      radialBias: 0.46
      asymmetry: 0.1
      lean: [0.08, -0.03]
      surfaceTension: 0.8
      lobeScaleMultiplier: 1.55
      scaleVariation: 0.07
      clumps:
        macroCount: 3
        subClumpCount: [2, 3]
        separation: 0.3
        anchoring: 0.78
        silhouetteBreakup: 0.1
    trunk:
      baseRadius: 0.42
      topRadius: 0.16
      bend: 0.3
      flare: 0.5
      segments: 8
      branchCount: 5
      color: '#6b543e'
      branching:
        depth: 2
        primaryCount: 3
        childCount: [1, 2]
        lengthDecay: 0.62
        radiusDecay: 0.6
        upwardBias: 0.6
        gnarl: 0.28
        twist: 0.3
        exposedTipRatio: 0.12
      barkPalette: ['#4a3a2b', '#6b543e', '#8a705a']
    foliage:
      leafShape: puff              # broadleaf until the puff shape lands
      palette: ['#41684d', '#6d9463', '#9dc27e', '#d9e8ac']
      variation: 0.08
      paletteBase: 0.55
      heightPaletteShift: 0.26
      exposurePaletteShift: 0.14
      radialNormalStrength: 0.88
      crownNormalBlend: 0.68
      wrapLight: 0.72
      skyLightStrength: 0.3
      cavityStrength: 0.22
      heightLightStrength: 0.2
      undersideTint: '#9fc0c4'     # NEW — teal shadow tint
      undersideStrength: 0.38      # NEW
      rimStrength: 0.35            # NEW — pale skylight halo
      rimPower: 2.5                # NEW
      translucencyStrength: 0.22   # NEW — sun-through-canopy glow
      surfaceBreakup: 0.02         # NEW — near-flat paint, no grain
      volume:
        resolution: 26
        smoothing: 0.68
        padding: 0.32
        noiseAmplitude: 0.035
        noiseFrequency: 0.9
        normalEpsilon: 0.024
        colorPatchScale: 0.6
        colorPatchStrength: 0.07
      core:
        scale: 0.7
        brightness: 0.62
      heroLeaves:
        enabled: true
        density: 0.09
        scale: 1.5
        embedRatio: 0.15
        protrusionRatio: 0.2
        leavesPerCluster: 5
        colorLift: 0.1
        colorJitter: 0.04
        roughness: 0.92
        layerCount: 1
        layerOffsetRatio: 0.16
      shell:
        candidatesPerLobe: 448     # 30% under roundOrchard; bigger cards cover more
        coverageCardRatio: 0.56
        sizeRatio: [0.115, 0.185]
        widthRatio: [0.8, 1.1]
        outwardRatio: [1.0, 1.28]
        radialOffsetRatio: 0.008
        exposureThreshold: 0.05
        colorJitter: 0.03
        paletteLift: 0.07
        cavityScale: 0.3
        normalBlend: 0.3
        alphaTest: 0.4
        planesPerCluster: 2
        shadowProxyScale: 0.98
```

**Blossom variant** (the pink-crowned tree in the reference): duplicate as
`gladeBlossom`, change only —

```yaml
      palette: ['#4a6b4f', '#7d9a68', '#c3cf96', '#efdcd3']
      paletteBase: 0.58
      heightPaletteShift: 0.3
      undersideTint: '#a8b8c9'
```

## `gladeBush`

```yaml
  gladeBush:
    label: Glade bush
    height: 1.7
    crown:
      profile: round
      baseHeight: 0.24
      height: 1.35
      radius: 1.2
      lobeCount: 7
      lobeScale: [0.68, 0.9]
      verticalScale: [0.72, 0.95]
      radialBias: 0.5
      asymmetry: 0.14
      lean: [0.04, -0.02]
      surfaceTension: 0.74
      lobeScaleMultiplier: 1.5
      scaleVariation: 0.08
      clumps:
        macroCount: 2
        subClumpCount: [2, 3]
        separation: 0.24
        anchoring: 0.75
        silhouetteBreakup: 0.14
    trunk:
      baseRadius: 0.1
      topRadius: 0.05
      bend: 0.12
      flare: 0.3
      segments: 4
      branchCount: 3
      color: '#54402f'
      branching:
        depth: 2
        primaryCount: 3
        childCount: [1, 2]
        lengthDecay: 0.6
        radiusDecay: 0.58
        upwardBias: 0.68
        gnarl: 0.18
        twist: 0.24
        exposedTipRatio: 0.1
      barkPalette: ['#42332a', '#5f4b3a', '#826a55']
    foliage:
      leafShape: puff
      palette: ['#3d6242', '#5f8c52', '#8fb56b', '#c9dd9a']
      variation: 0.09
      paletteBase: 0.52
      heightPaletteShift: 0.2
      exposurePaletteShift: 0.12
      radialNormalStrength: 0.86
      crownNormalBlend: 0.6
      wrapLight: 0.7
      skyLightStrength: 0.28
      cavityStrength: 0.24
      heightLightStrength: 0.16
      undersideTint: '#8fb0ab'     # NEW
      undersideStrength: 0.32      # NEW
      rimStrength: 0.3             # NEW
      rimPower: 2.5                # NEW
      translucencyStrength: 0.18   # NEW
      surfaceBreakup: 0.02         # NEW
      volume:
        resolution: 22
        smoothing: 0.66
        padding: 0.3
        noiseAmplitude: 0.04
        noiseFrequency: 1.0
        normalEpsilon: 0.024
        colorPatchScale: 0.55
        colorPatchStrength: 0.08
      core:
        scale: 0.7
        brightness: 0.6
      heroLeaves:
        enabled: true
        density: 0.1
        scale: 1.35
        embedRatio: 0.14
        protrusionRatio: 0.2
        leavesPerCluster: 5
        colorLift: 0.08
        colorJitter: 0.04
        roughness: 0.9
        layerCount: 1
        layerOffsetRatio: 0.16
      shell:
        candidatesPerLobe: 288
        coverageCardRatio: 0.5
        sizeRatio: [0.13, 0.21]
        widthRatio: [0.78, 1.08]
        outwardRatio: [1.0, 1.26]
        radialOffsetRatio: 0.01
        exposureThreshold: 0.05
        colorJitter: 0.035
        paletteLift: 0.06
        cavityScale: 0.3
        normalBlend: 0.28
        alphaTest: 0.4
        planesPerCluster: 2
        shadowProxyScale: 0.98
```

## Wiring checklist

1. Append both presets to `config/tree-presets.yaml` (they auto-register through
   `PresetLibrary.fromConfig`; the demo's preset cycling and tuning panel pick them up).
2. Forest banding (`forest-scene.js`): `gladeCanopy` (7.4 m) lands in the canopy band,
   `gladeBush` (1.7 m) in ground cover — no code change.
3. Garden layout (`config/scene.yaml`): add entries for a hero shot, e.g.
   `gladeCanopy` at `[-5.2, 0, 0.7]` and two `gladeBush` near the camera.
4. Until look-plan §1 lands, the `# NEW` keys are inert — the presets still render with
   today's shader and should already read ~70% of the way there (palette + crown shape
   carry most of it).
5. Re-run QA: `tools/run-shell-coverage-qa.js`, canopy solidity, LOD budgets. Expected
   cost: **below** roundOrchard on every axis (fewer lobes ×  fewer candidates; shell
   instance count down ~25–35%; branch geometry count down ~40% from depth 2).
6. Screenshot check against the reference: default garden camera + a low forest-clearing
   angle, midday sun from `scene.yaml` retune (look plan §3).
