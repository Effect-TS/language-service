---
title: "Unnecessary Pipe"
---

# Unnecessary Pipe

## Pattern

This rule detects `.pipe()` calls with no arguments or `pipe()` function calls with only one argument. These are redundant and can be simplified.

```typescript
// Detected patterns
Effect.succeed(32).pipe()      // .pipe() with no arguments
pipe(32)                       // pipe() with single argument
```

## Symptoms

You might have unnecessary pipes if you notice:

- **Empty `.pipe()` calls**: Code that ends with `.pipe()` but no transformations inside
- **Leftover refactoring artifacts**: Pipes that remain after transformations were removed
- **Confusing code**: Pipes that seem to do nothing and make you question their purpose

## Why It's Bad

1. **No-op code**: A pipe with no transformations does nothing
2. **Noise**: Adds visual clutter without adding value
3. **Potential mistake**: Often indicates forgotten transformations
4. **Performance**: Unnecessary function call overhead

## How to Fix

Remove the unnecessary pipe call:

**Before:**
```typescript
const value = Effect.succeed(32).pipe()
const other = pipe(someValue)
```

**After:**
```typescript
const value = Effect.succeed(32)
const other = someValue
```

## Configuration

### Disable globally

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "diagnostics": {
        "unnecessaryPipe": "off"
      }
    }]
  }
}
```

### Disable for file

```typescript
// @effect-diagnostics ignore unnecessaryPipe
```

### Disable next line

```typescript
// @effect-diagnostics ignore-next-line unnecessaryPipe
const value = Effect.succeed(32).pipe()
```

## Examples

- [Bad code](./examples/bad.ts) - Unnecessary pipe calls
- [Good code](./examples/good.ts) - Proper pipe usage
