---
"@effect/language-service": minor
---

Add `layerMergeAllWithDependencies` diagnostic to detect interdependencies in `Layer.mergeAll` calls

This new diagnostic warns when `Layer.mergeAll` is called with layers that have interdependencies, where one layer provides a service that another layer in the same call requires.

`Layer.mergeAll` creates layers in parallel, so dependencies between layers will not be satisfied. This can lead to runtime errors when trying to use the merged layer.

Example of code that triggers the diagnostic:
```typescript
export class DbConnection extends Effect.Service<DbConnection>()("DbConnection", {
  succeed: {}
}) {}
export class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
  succeed: {}
}) {}
export class Cache extends Effect.Service<Cache>()("Cache", {
  effect: Effect.as(FileSystem, {})  // Cache requires FileSystem
}) {}

// ⚠️ Warning on FileSystem.Default
const layers = Layer.mergeAll(
  DbConnection.Default,
  FileSystem.Default,  // This provides FileSystem
  Cache.Default        // This requires FileSystem
)
```

Recommended approach:
```typescript
// Provide FileSystem separately before merging
const layers = Layer.mergeAll(
  DbConnection.Default,
  Cache.Default
).pipe(Layer.provideMerge(FileSystem.Default))
```

The diagnostic correctly handles pass-through layers (layers that both provide and require the same type) and only reports on layers that actually provide dependencies needed by other layers in the same `mergeAll` call.
