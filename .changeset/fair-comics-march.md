---
"@effect/language-service": minor
---

Add the `effectMapFlatten` style diagnostic for `Effect.map(...)` immediately followed by `Effect.flatten` in pipe flows.

Example:

```ts
import { Effect } from "effect"

const program = Effect.succeed(1).pipe(
  Effect.map((n) => Effect.succeed(n + 1)),
  Effect.flatten
)
```
