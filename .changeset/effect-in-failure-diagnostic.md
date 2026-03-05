---
"@effect/language-service": minor
---

Add a new `effectInFailure` diagnostic that warns when an `Effect` computation appears in the failure channel (`E`) of another `Effect`.

The rule traverses Effect-typed expressions, unrolls union members of `E`, and reports when any member is itself a strict Effect type.

It prefers innermost matches for nested cases (for example nested `Effect.try` in `catch`) to avoid noisy parent reports.
