---
"@effect/language-service": patch
---

Fix handling of read-only arrays in "Refactor to Schema (Recursive Structural)" code generation. 

The refactor now correctly distinguishes between mutable arrays (`Array<T>`) and read-only arrays (`ReadonlyArray<T>` or `readonly T[]`):
- `Array<T>` is now converted to `Schema.mutable(Schema.Array(...))` to preserve mutability
- `ReadonlyArray<T>` and `readonly T[]` are converted to `Schema.Array(...)` (read-only by default)

This fixes compatibility issues with external libraries (like Stripe, BetterAuth) that expect mutable arrays in their API parameters.

Fixes #531
