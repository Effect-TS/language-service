---
"@effect/language-service": patch
---

Improve yield-based diagnostics and hover behavior by introducing `effectYieldableType` in `TypeParser` and using it in `missingReturnYieldStar`.

- In Effect v4, yieldable values are recognized through `asEffect()` and mapped to Effect `A/E/R`.
- In Effect v3, `effectYieldableType` falls back to standard `effectType` behavior.
- `missingReturnYieldStar` now correctly handles yieldable values such as `Option.none()`.
- Hover support for `yield*` was updated to use yieldable parsing paths.
