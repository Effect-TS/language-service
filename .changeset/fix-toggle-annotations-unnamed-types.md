---
"@effect/language-service": patch
---

Fix toggle type annotation and toggle return type annotation refactors to handle unnamed/unresolved types

The refactors now use `ts.NodeBuilderFlags.IgnoreErrors` flag when generating type annotations, allowing them to work correctly with types that have errors or are unnamed (e.g., `Schema.Struct({ ... }).make`). This prevents the refactors from failing when the type contains unresolved references or complex type expressions.
