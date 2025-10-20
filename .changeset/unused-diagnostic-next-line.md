---
"@effect/language-service": minor
---

Add diagnostic to warn when `@effect-diagnostics-next-line` comments have no effect. This helps identify unused suppression comments that don't actually suppress any diagnostics, improving code cleanliness.

The new `missingDiagnosticNextLine` option controls the severity of this diagnostic (default: "warning"). Set to "off" to disable.

Example:
```ts
// This comment will trigger a warning because it doesn't suppress any diagnostic
// @effect-diagnostics-next-line effect/floatingEffect:off
const x = 1

// This comment is correctly suppressing a diagnostic
// @effect-diagnostics-next-line effect/floatingEffect:off
Effect.succeed(1)
```
