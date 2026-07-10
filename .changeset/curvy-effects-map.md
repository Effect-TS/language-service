---
"@effect/language-service": minor
---

Add the `flatMapToMap` style diagnostic, which suggests replacing `Effect.flatMap((value) => Effect.succeed(f(value)))` with `Effect.map((value) => f(value))`.
