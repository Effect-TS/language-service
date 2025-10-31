---
"@effect/language-service": minor
---

Add support for following symbols in Layer Graph visualization

The layer graph feature now supports following symbol references to provide deeper visualization of layer dependencies. This is controlled by the new `layerGraphFollowDepth` configuration option (default: 0).

Example:
```typescript
// With layerGraphFollowDepth: 1
export const myLayer = otherLayer.pipe(Layer.provide(DbConnection.Default))
// Now visualizes the full dependency tree by following the 'otherLayer' reference
```
