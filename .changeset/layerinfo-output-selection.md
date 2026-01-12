---
"@effect/language-service": patch
---

Enhanced `layerinfo` CLI command with output type selection for layer composition.

**New Features:**
- Added `--outputs` option to select which output types to include in the suggested composition (e.g., `--outputs 1,2,3`)
- Shows all available output types from the layer graph with indexed checkboxes
- By default, only types that are in the layer's declared `ROut` are selected
- Composition code now includes `export const <name> = ...` prefix for easy copy-paste

**Example output:**
```
Suggested Composition:
  Not sure you got your composition right? Just write all layers inside a Layer.mergeAll(...)
  then run this command again and use --outputs to select which outputs to include in composition.
  Example: --outputs 1,2,3

  [ ] 1. Cache
  [x] 2. UserRepository

  export const simplePipeIn = UserRepository.Default.pipe(
    Layer.provide(Cache.Default)
  )
```

This allows users to see all available outputs from a layer composition and choose which ones to include in the suggested composition order.
