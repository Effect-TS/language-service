---
"@effect/language-service": minor
---

feat: add gen-block syntax support

Adds support for the ergonomic `gen {}` syntax as an alternative to `Effect.gen(function*() { })`.

## New `check` command

The `effect-language-service check` command provides TypeScript type-checking for files with gen-block syntax:

```bash
# Check a project
effect-language-service check --project tsconfig.json

# Check a single file  
effect-language-service check --file src/program.ts

# Output formats
effect-language-service check --format json  # Machine-readable
effect-language-service check --format pretty # Colored output (default)
effect-language-service check --format text   # Plain text
```

## Gen-block syntax

```typescript
// Gen-block syntax (input)
const program = gen {
  user <- getUser(id)
  profile <- getProfile(user.id)
  let name = user.name.toUpperCase()
  return { user, profile, name }
}

// Transforms to Effect.gen (output)
const program = Effect.gen(function* () {
  const user = yield* getUser(id)
  const profile = yield* getProfile(user.id)
  const name = user.name.toUpperCase()
  return { user, profile, name }
})
```

## Features

### CLI
- **Type checking**: Full TypeScript type checking with position mapping back to original source
- **Error reporting**: Clear error messages with `[gen-block]` marker for transformed files
- **JSON output**: Machine-readable format for CI/CD and tooling integration

### VSCode Integration
- **Hover**: Tooltips display correct type information at original source positions
- **Go-to-definition**: Cmd+Click jumps to correct definition locations
- **Completions**: Auto-complete works inside gen blocks
- **Position mapping**: Segment-based mapping between original `gen {}` and transformed `Effect.gen()` code
