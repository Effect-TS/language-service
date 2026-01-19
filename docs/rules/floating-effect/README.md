---
title: "Floating Effect"
---

# Floating Effect

## Pattern

This rule detects Effect expressions that are neither yielded nor assigned to a variable. These "floating" effects are statements that produce an Effect value but do nothing with it.

```typescript
Effect.succeed("floating") // This Effect is created but never used
```

## Symptoms

You might have floating effects if you observe:

- **Effect is not running**: You wrote `Effect.log("message")` but nothing appears in the console
- **Database/API calls not happening**: Your HTTP request or database query never executes
- **State not updating**: A state change you expected isn't occurring
- **Side effects missing**: File writes, notifications, or other side effects don't happen
- **Async operations silently ignored**: Promises/Effects you expected to run are skipped

## Why It's Bad

In Effect, creating an Effect value doesn't execute it - Effects are descriptions of computations that need to be explicitly run or composed. A floating Effect means:

1. **Silent bugs**: The intended operation never executes
2. **Dead code**: You wrote code that has no effect on the program
3. **Missed errors**: Any errors the Effect would produce are never handled

This is especially dangerous inside `Effect.gen` blocks where you might forget to `yield*` an Effect.

## How to Fix

Depending on your intent:

1. **Yield the Effect** (inside `Effect.gen`):
   ```typescript
   yield* Effect.succeed("now it runs")
   ```

2. **Assign to a variable** (if you need the value later):
   ```typescript
   const result = Effect.succeed("stored for later")
   ```

3. **Run the Effect** (if it should execute immediately):
   ```typescript
   Effect.runPromise(Effect.succeed("runs now"))
   ```

4. **Remove the code** (if it's truly dead code)

## Configuration

### Disable globally

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "diagnostics": {
        "floatingEffect": "off"
      }
    }]
  }
}
```

### Disable for file

Add at the top of the file:

```typescript
// @effect-diagnostics ignore floatingEffect
```

### Disable next line

```typescript
// @effect-diagnostics ignore-next-line floatingEffect
Effect.succeed("intentionally floating")
```

## Examples

- [Bad code](./examples/bad.ts) - Floating effects that trigger the diagnostic
- [Good code](./examples/good.ts) - Properly handled effects
