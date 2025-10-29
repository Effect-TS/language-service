---
"@effect/language-service": minor
---

Add `strictEffectProvide` diagnostic to warn when using Effect.provide with Layer outside of application entry points

This new diagnostic helps developers identify potential scope lifetime issues by detecting when `Effect.provide` is called with a Layer argument in locations that are not application entry points.

**Example:**

```typescript
// Will trigger diagnostic
export const program = Effect.void.pipe(
  Effect.provide(MyService.Default)
)
```

**Message:**
> Effect.provide with a Layer should only be used at application entry points. If this is an entry point, you can safely disable this diagnostic. Otherwise, using Effect.provide may break scope lifetimes. Compose all layers at your entry point and provide them at once.

**Configuration:**
- **Default severity**: `"off"` (opt-in)
- **Diagnostic name**: `strictEffectProvide`

This diagnostic is disabled by default and can be enabled via tsconfig.json:

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "diagnosticSeverity": {
        "strictEffectProvide": "warning"
      }
    }]
  }
}
```
