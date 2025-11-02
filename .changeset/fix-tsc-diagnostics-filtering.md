---
"@effect/language-service": patch
---

Fix TSC patching mode to properly filter diagnostics by module name. The `reportSuggestionsAsWarningsInTsc` option now only affects the TSC module and not the TypeScript module, preventing suggestions from being incorrectly reported in non-TSC contexts.
