---
title: "Missed Pipeable Opportunity"
---

# Missed Pipeable Opportunity

## Pattern

This rule detects nested function calls that could be rewritten using the pipeable style (`.pipe()`). Effect types support a `.pipe()` method that enables a more readable left-to-right flow.

```typescript
// Detected pattern
toString(double(addOne(5)))
```

## Symptoms

You might benefit from pipe style if you experience:

- **Hard to read transformations**: You have to read code inside-out to understand data flow
- **Parenthesis matching errors**: Adding or removing steps causes bracket mismatches
- **Inconsistent codebase style**: Mix of nested calls and pipe style in the same project
- **Difficulty reviewing changes**: PRs with nested calls are harder to review than pipe chains

## Why It's Bad

Deeply nested function calls have several readability issues:

1. **Inside-out reading**: You must read from innermost to outermost
2. **Hard to follow**: Data flow is obscured by nesting
3. **Difficult to modify**: Adding/removing steps requires careful parenthesis management
4. **Inconsistent style**: Effect idiomatically uses pipe style

## How to Fix

Convert nested calls to pipe style:

**Before:**
```typescript
const result = toString(double(addOne(5)))
```

**After:**
```typescript
const result = addOne(5).pipe(double, toString)
```

The pipe style reads left-to-right, making the data transformation flow clear.

## Configuration

### Set minimum argument count

Control how many nested calls trigger the diagnostic:

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "pipeableMinArgCount": 2
    }]
  }
}
```

Default is `2`, meaning at least 2 transformations are needed to trigger.

### Enable the rule

This rule is **off by default**. To enable it:

```json
{
  "compilerOptions": {
    "plugins": [{
      "name": "@effect/language-service",
      "diagnostics": {
        "missedPipeableOpportunity": "warning"
      }
    }]
  }
}
```

### Disable for file

```typescript
// @effect-diagnostics ignore missedPipeableOpportunity
```

### Disable next line

```typescript
// @effect-diagnostics ignore-next-line missedPipeableOpportunity
const result = toString(double(addOne(5)))
```

## Examples

- [Bad code](./examples/bad.ts) - Nested calls that could use pipe
- [Good code](./examples/good.ts) - Using pipe style
