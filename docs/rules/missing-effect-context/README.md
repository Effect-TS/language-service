---
title: "Missing Effect Context"
---

# Missing Effect Context

## Pattern

This rule detects when an Effect requires services in its context (the `R` type parameter) that are not provided by the expected type. This is a type-level diagnostic that helps catch missing service dependencies.

```typescript
// Detected pattern
const effect: Effect<number> = effectRequiringServices
//                             ^-- Missing ServiceA | ServiceB in context
```

## Symptoms

You might have missing context if you experience:

- **"Service not found" runtime errors**: Effect fails with errors about missing services when run
- **Type errors mentioning `R` channel**: TypeScript complains about incompatible Effect types
- **Services "disappearing"**: An Effect that worked stops working when assigned to a different type
- **Dependency injection failures**: `Effect.provide` or Layers don't seem to satisfy requirements

## Why It's Bad

Effect's context channel (`R` type parameter) tracks which services an Effect needs to run. When you assign an Effect that requires services to a type that doesn't expect them:

1. **Runtime errors**: The Effect will fail at runtime when services aren't provided
2. **Silent dependency hiding**: The type system loses track of required services
3. **Broken composition**: Effects can't be properly composed if dependencies are hidden

This diagnostic surfaces these issues before they become runtime failures.

## How to Fix

Depending on the situation:

1. **Add the missing service to the expected type:**
   ```typescript
   const effect: Effect<number, never, ServiceA | ServiceB> = effectRequiringServices
   ```

2. **Provide the missing service:**
   ```typescript
   const effect: Effect<number> = effectRequiringServices.pipe(
     Effect.provideService(ServiceA, serviceAImpl)
   )
   ```

3. **Use a Layer to provide services:**
   ```typescript
   const effect: Effect<number> = effectRequiringServices.pipe(
     Effect.provide(ServiceA.Live)
   )
   ```

## Configuration

### Disable globally

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "diagnostics": {
        "missingEffectContext": "off"
      }
    }]
  }
}
```

### Disable for file

```typescript
// @effect-diagnostics ignore missingEffectContext
```

### Disable next line

```typescript
// @effect-diagnostics ignore-next-line missingEffectContext
const effect: Effect<number> = effectRequiringServices
```

## Examples

- [Bad code](./examples/bad.ts) - Effects with missing context requirements
- [Good code](./examples/good.ts) - Properly typed effects with context
