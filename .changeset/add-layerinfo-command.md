---
"@effect/language-service": minor
---

Added `layerinfo` CLI command that provides detailed information about a specific exported layer.

Features:
- Shows layer type, location, and description
- Lists services the layer provides and requires
- Suggests optimal layer composition order using `Layer.provide`, `Layer.provideMerge`, and `Layer.merge`

Example usage:
```bash
effect-language-service layerinfo --file ./src/layers/app.ts --name AppLive
```

Also added a tip to both `overview` and `layerinfo` commands about using `Layer.mergeAll(...)` to get suggested composition order.
