---
"@effect/language-service": patch
---

Add Effect v4 support for the `runEffectInsideEffect` diagnostic so it suggests and fixes `Effect.run*With` usage based on `Effect.services`.

Update the generated metadata, schema, README entry, and v4 harness examples/snapshots to document and verify the new behavior.
