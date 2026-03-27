---
"@effect/language-service": patch
---

Fix `effectFnImplicitAny` so it does not report false positives when an `Effect.fn` or `Effect.fnUntraced` callback gets its contextual function type from a union member.

For example, nested `HttpRouter.add(...)` handlers now correctly recognize the inferred `request` type and produce no diagnostics when the parameter is not actually implicit `any`.
