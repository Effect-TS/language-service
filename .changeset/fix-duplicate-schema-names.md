---
"@effect/language-service": patch
---

Fix duplicate schema names in "Refactor to Schema (Recursive Structural)" code generation.

When the refactor encountered types with conflicting names, it was generating a unique suffix but not properly tracking the usage count, causing duplicate schema identifiers with different contents to be generated.

This fix ensures that when a name conflict is detected and a unique suffix is added (e.g., `Tax`, `Tax_1`, `Tax_2`), the usage counter is properly incremented to prevent duplicate identifiers in the generated code.

Fixes #534
