---
title: "Effect.fn Opportunity"
---

# Effect.fn Opportunity

## Pattern

This rule suggests using `Effect.fn` for functions that return an Effect, especially those using `Effect.gen`. The `Effect.fn` API provides better performance and automatic tracing.

```typescript
// Detected pattern
const myFunction = () => Effect.gen(function* () {
  yield* Effect.succeed(1)
  return 42
})
```

## Symptoms

You might benefit from `Effect.fn` if you notice:

- **Missing function names in traces**: Your spans show anonymous functions instead of meaningful names
- **Hard to debug stack traces**: Traces lack context about which function was executing
- **Performance concerns**: Profiling shows excessive allocations in hot paths
- **Verbose generator boilerplate**: Repeated `() => Effect.gen(function* () { ... })` patterns

## Why It's Bad

Functions returning `Effect.gen` have several issues:

1. **Performance**: The generator function is reallocated on every call
2. **No tracing**: Function calls aren't automatically traced in spans
3. **Verbose**: More boilerplate than necessary

`Effect.fn` solves all these issues by:
- Allocating the generator function once
- Automatically adding the function name to traces
- Providing a cleaner API

## How to Fix

Convert functions to use `Effect.fn`:

**Before:**
```typescript
const myFunction = () => Effect.gen(function* () {
  yield* Effect.succeed(1)
  return 42
})
```

**After (with tracing):**
```typescript
const myFunction = Effect.fn("myFunction")(function* () {
  yield* Effect.succeed(1)
  return 42
})
```

**After (without tracing):**
```typescript
const myFunction = Effect.fnUntraced(function* () {
  yield* Effect.succeed(1)
  return 42
})
```

## Configuration

### Configure available fixes

You can control which fix options are shown:

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "effectFn": ["span", "inferred-span", "no-span", "untraced"]
    }]
  }
}
```

Options:
- `"span"`: Show fix to use explicit span from `withSpan`
- `"inferred-span"`: Show fix to use inferred function name as span
- `"no-span"`: Show fix without any span
- `"untraced"`: Show fix using `Effect.fnUntraced`

### Disable globally

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "diagnostics": {
        "effectFnOpportunity": "off"
      }
    }]
  }
}
```

### Disable for file

```typescript
// @effect-diagnostics ignore effectFnOpportunity
```

### Disable next line

```typescript
// @effect-diagnostics ignore-next-line effectFnOpportunity
const myFunction = () => Effect.gen(function* () { ... })
```

## Examples

- [Bad code](./examples/bad.ts) - Functions that could use Effect.fn
- [Good code](./examples/good.ts) - Properly using Effect.fn
