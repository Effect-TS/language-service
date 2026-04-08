---
"@effect/language-service": minor
---

Add the `effectDoNotation` style diagnostic for `Effect.Do` usage and suggest migrating to `Effect.gen` or `Effect.fn`.

Example:

```ts
import { pipe } from "effect/Function"
import { Effect } from "effect"

const program = pipe(
  Effect.Do,
  Effect.bind("a", () => Effect.succeed(1)),
  Effect.let("b", ({ a }) => a + 1)
)
```
