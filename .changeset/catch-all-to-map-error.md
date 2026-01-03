---
"@effect/language-service": minor
---

Added new diagnostic `catchAllToMapError` that suggests using `Effect.mapError` instead of `Effect.catchAll` + `Effect.fail` when the callback only wraps the error.

Before:
```ts
Effect.catchAll((cause) => Effect.fail(new MyError(cause)))
```

After:
```ts
Effect.mapError((cause) => new MyError(cause))
```

The diagnostic includes a quick fix that automatically transforms the code.
