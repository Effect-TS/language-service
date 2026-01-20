# Multi-Version Effect Support Specification

## Overview

This specification describes the restructuring of the Effect Language Service repository to support both Effect v3 and Effect v4. The language service will continue to be built using Effect v3 internally, but will be tested against both Effect versions to ensure compatibility with projects using either version.

## Goals

1. **Dual Version Testing**: Validate the language service works correctly with both Effect v3 and Effect v4 codebases
2. **Version-Specific Snapshots**: Maintain separate expected outputs for each Effect version since types and APIs differ
3. **Shared Test Logic**: Keep test implementation code DRY by sharing test files across versions
4. **Independent Examples**: Allow different example files per version to accommodate API changes
5. **CLI Testing**: Ensure the language service CLI works correctly with both versions

## Why This Works

The language service operates at the TypeScript AST and type-checking level. It:
- Analyzes TypeScript code that uses Effect
- Does not execute Effect code at runtime
- Is bundled as a standalone JS file with Effect tree-shaken and bundled in
- Works with any Effect version installed in the user's project

Therefore, the same bundled language service can analyze projects using either Effect v3 or v4.

## Repository Structure

### Proposed Directory Layout

```
/language-service/
├── packages/
│   ├── language-service/           # Main plugin package
│   │   ├── src/
│   │   │   ├── cli/               # CLI commands
│   │   │   ├── core/              # Core utilities (Nano, TypeParser, etc.)
│   │   │   ├── diagnostics/       # Diagnostic implementations
│   │   │   ├── completions/       # Completion features
│   │   │   ├── refactors/         # Refactor transformations
│   │   │   └── ...                # Other features
│   │   ├── test/
│   │   │   ├── *.test.ts          # Test logic (shared across versions)
│   │   │   └── utils/             # Test utilities
│   │   ├── dist/                  # Bundled output
│   │   ├── package.json           # effect@3 as devDependency
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── harness-effect-v3/          # Test harness for Effect v3
│   │   ├── examples/
│   │   │   ├── diagnostics/       # v3 diagnostic examples
│   │   │   ├── refactors/         # v3 refactor examples
│   │   │   ├── completions/       # v3 completion examples
│   │   │   └── ...                # Other feature examples
│   │   ├── __snapshots__/
│   │   │   ├── diagnostics/       # v3 diagnostic snapshots
│   │   │   ├── refactors/         # v3 refactor snapshots
│   │   │   └── ...                # Other feature snapshots
│   │   ├── package.json           # effect@3 as dependency
│   │   └── tsconfig.json
│   │
│   └── harness-effect-v4/          # Test harness for Effect v4
│       ├── examples/
│       │   ├── diagnostics/       # v4 diagnostic examples
│       │   ├── refactors/         # v4 refactor examples
│       │   ├── completions/       # v4 completion examples
│       │   └── ...                # Other feature examples
│       ├── __snapshots__/
│       │   ├── diagnostics/       # v4 diagnostic snapshots
│       │   ├── refactors/         # v4 refactor snapshots
│       │   └── ...                # Other feature snapshots
│       ├── package.json           # effect@4 as dependency
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── package.json                    # Root package with orchestration scripts
├── vitest.workspace.ts             # Vitest workspace configuration
└── specs/                          # Specifications (this folder)
```

### Package Responsibilities

#### `packages/language-service`

The main plugin package containing:
- All source code for diagnostics, completions, refactors, etc.
- Test logic (*.test.ts files) that is parameterized to work with any harness
- Build configuration (tsup) that bundles everything into a single JS file
- Uses Effect v3 as a devDependency for building

This package is what gets published to npm.

#### `packages/harness-effect-v3`

Test harness for Effect v3 containing:
- Example TypeScript files using Effect v3 APIs
- Expected snapshot outputs for v3
- Depends on `effect@3` and `@effect/language-service` (workspace)

This package is private (not published).

#### `packages/harness-effect-v4`

Test harness for Effect v4 containing:
- Example TypeScript files using Effect v4 APIs (migrated/adapted)
- Expected snapshot outputs for v4
- Depends on `effect@4` and `@effect/language-service` (workspace)

This package is private (not published).

## Configuration Files

### Root `pnpm-workspace.yaml`

```yaml
packages:
  - "packages/*"
```

### Root `package.json`

```json
{
  "name": "effect-language-service-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm --filter @effect/language-service build",
    "dev": "pnpm --filter @effect/language-service dev",
    "test": "pnpm test:v3 && pnpm test:v4",
    "test:v3": "HARNESS=v3 pnpm --filter @effect/language-service test",
    "test:v4": "HARNESS=v4 pnpm --filter @effect/language-service test",
    "test-update": "pnpm test-update:v3 && pnpm test-update:v4",
    "test-update:v3": "HARNESS=v3 pnpm --filter @effect/language-service test-update",
    "test-update:v4": "HARNESS=v4 pnpm --filter @effect/language-service test-update",
    "lint": "pnpm -r lint",
    "lint-fix": "pnpm -r lint-fix",
    "check": "pnpm -r check",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "@changesets/cli": "^2.29.8"
  },
  "packageManager": "pnpm@8.11.0"
}
```

Note: Tests run directly against TypeScript source via vitest - no build step required. The build is only needed for publishing.

### `packages/language-service/package.json`

```json
{
  "name": "@effect/language-service",
  "version": "0.71.0",
  "description": "Effect Language Service",
  "main": "dist/index.js",
  "bin": {
    "effect-language-service": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint src test",
    "lint-fix": "eslint src test --fix",
    "check": "tsc -b tsconfig.json",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "effect": "^3.19.14",
    "@effect/platform": "^0.94.1",
    "@effect/platform-node": "^0.104.0",
    "typescript": "^5.9.3",
    "tsup": "^8.5.1",
    "vitest": "^4.0.17"
  }
}
```

### `packages/harness-effect-v3/package.json`

The harness packages contain examples and snapshots. They have check and lint scripts to ensure examples are valid and properly formatted.

```json
{
  "name": "@effect/harness-effect-v3",
  "private": true,
  "scripts": {
    "check": "tsc -b tsconfig.json",
    "lint": "eslint examples",
    "lint-fix": "eslint examples --fix"
  },
  "dependencies": {
    "effect": "^3.19.14",
    "@effect/platform": "^0.94.1"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "eslint": "^9.39.2"
  }
}
```

### `packages/harness-effect-v4/package.json`

```json
{
  "name": "@effect/harness-effect-v4",
  "private": true,
  "scripts": {
    "check": "tsc -b tsconfig.json",
    "lint": "eslint examples",
    "lint-fix": "eslint examples --fix"
  },
  "dependencies": {
    "effect": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "eslint": "^9.39.2"
  }
}
```

## Test Execution Strategy

### How Tests Know Which Harness to Use

The test files live in `packages/language-service/test/` and need to know:
1. Where to find example files
2. Where to read/write snapshots

This is achieved through the `HARNESS` environment variable:

```typescript
// packages/language-service/test/diagnostics.test.ts
const HARNESS = process.env.HARNESS
if (!HARNESS) throw new Error("HARNESS environment variable must be set (v3 or v4)")

const HARNESS_ROOT = path.resolve(__dirname, `../../harness-effect-${HARNESS}`)
const EXAMPLES_DIR = path.join(HARNESS_ROOT, "examples")
const SNAPSHOTS_DIR = path.join(HARNESS_ROOT, "__snapshots__")
```

Tests require an explicit `HARNESS` value - they will fail if not specified. This ensures tests always run against a known Effect version.

### Running Tests

All test commands are run from the root and execute vitest in the language-service package:

```bash
# Run all tests (v3 then v4)
pnpm test

# Run only v3 tests
pnpm test:v3

# Run only v4 tests
pnpm test:v4

# Update all snapshots (v3 then v4)
pnpm test-update

# Update only v3 snapshots
pnpm test-update:v3

# Update only v4 snapshots
pnpm test-update:v4
```

Tests always run with an explicit harness version - there is no default.

### No Build Required

Tests run directly against TypeScript source via vitest's built-in TypeScript support. The bundled build (tsup) is only needed for publishing to npm, not for running tests.

## CLI Testing

CLI tests live in the language-service package alongside other tests. They invoke the CLI against the harness directories:

```typescript
// packages/language-service/test/cli-diagnostics.test.ts
import { execSync } from "child_process"

const HARNESS = process.env.HARNESS
if (!HARNESS) throw new Error("HARNESS environment variable must be set (v3 or v4)")

const HARNESS_ROOT = path.resolve(__dirname, `../../harness-effect-${HARNESS}`)

test("CLI diagnostics works", () => {
  const result = execSync(
    `tsx src/cli.ts diagnostics ${HARNESS_ROOT}/examples`,
    { cwd: path.resolve(__dirname, "..") }
  )
  // assertions...
})
```

The CLI operates on the harness's examples directory, which contains TypeScript files that import from the harness's `node_modules` (with the appropriate Effect version).

## Migration Plan

### Phase 1: Repository Restructure

1. Create `packages/` directory
2. Move source code to `packages/language-service/src/`
3. Move test logic to `packages/language-service/test/`
4. Update import paths and configurations
5. Create `pnpm-workspace.yaml`
6. Update root `package.json`

### Phase 2: Create v3 Harness

1. Create `packages/harness-effect-v3/`
2. Move existing examples to `packages/harness-effect-v3/examples/`
3. Move existing snapshots to `packages/harness-effect-v3/__snapshots__/`
4. Create `package.json` with Effect v3 dependency
5. Configure vitest
6. Verify all tests pass

### Phase 3: Create v4 Harness (Empty Structure)

1. Create `packages/harness-effect-v4/`
2. Create empty directory structure:
   - `examples/diagnostics/`
   - `examples/completions/`
   - `examples/refactors/`
   - `examples/utils/`
   - (other feature directories)
   - `__snapshots__/diagnostics/`
   - `__snapshots__/refactors/`
   - (other snapshot directories)
3. Create `package.json` with Effect v4 dependency (pkg.pr.new)
4. Create `tsconfig.json`
5. Examples and snapshots will be added gradually over time

### Phase 4: CI Configuration

1. Update CI workflows for workspace structure
2. Run tests sequentially (`pnpm test` runs v3 then v4)
3. Update snapshot publishing path for workspace
4. Ensure changesets ignores harness packages

## Considerations

### API Differences Between Effect v3 and v4

Effect v4 has significant API changes. Each diagnostic, completion, and refactor may need to handle:
- Renamed types or functions
- Changed type signatures
- New patterns to detect
- Removed patterns that no longer apply

The language service code should handle both versions gracefully, detecting which patterns are present in the analyzed code.

### Snapshot Differences

Snapshots will differ between versions because:
- Type names may differ (e.g., different error messages)
- Line numbers may shift if example code changes
- Diagnostic messages may be adjusted per version
- Quick fix outputs may produce different code

This is expected and the separate snapshot directories accommodate this.

### Performance

Running tests for both versions doubles the test execution time. Mitigations:
- Run v3 and v4 tests in parallel in CI
- Use Turborepo caching if build times become significant
- Consider running only the relevant version during development

### Maintenance Burden

Maintaining two sets of examples and snapshots increases maintenance. Mitigations:
- Automate migration tooling where possible
- Document version-specific behaviors clearly
- Consider generating v4 examples from v3 where APIs are similar

## Additional Configuration Details

### GitHub Actions CI Updates

The repository has 4 workflows that need updates:

#### `.github/workflows/check.yml`
```yaml
# Update to run check across all packages
- run: pnpm check
- run: pnpm lint
```
No changes needed - `pnpm -r check` and `pnpm -r lint` will work.

#### `.github/workflows/test.yml`
```yaml
# Run v3 and v4 tests sequentially
- run: pnpm test
```

#### `.github/workflows/build.yml`
```yaml
# Update circular dependency check to target language-service only
- run: pnpm --filter @effect/language-service circular
# Changesets will work automatically with workspace
```

#### `.github/workflows/snapshot.yml`
```yaml
# Update to publish from language-service dist
- run: pnpx pkg-pr-new publish --pnpm --comment=off ./packages/language-service/dist
```

### Additional Harness Dependencies

Examples use additional Effect packages that must be included in harness dependencies:

```json
// packages/harness-effect-v3/package.json
{
  "dependencies": {
    "effect": "^3.19.14",
    "@effect/platform": "^0.94.1",
    "@effect/sql": "^0.49.0",
    "@effect/rpc": "^0.73.0"
  }
}

// packages/harness-effect-v4/package.json
// Note: Effect v4 not yet on npm - use pkg.pr.new continuous release
{
  "dependencies": {
    "effect": "https://pkg.pr.new/Effect-TS/effect-smol/effect@e177d6c"
  }
  // Add @effect/platform, @effect/sql, @effect/rpc once v4-compatible versions are available
}
```

### Shared Example Utilities

The current `examples/utils/types.ts` contains shared types used by examples:

```typescript
// Exports: ExternalUser, ExternalStatus, User, etc.
```

Each harness should have its own copy:
- `packages/harness-effect-v3/examples/utils/types.ts`
- `packages/harness-effect-v4/examples/utils/types.ts`

These may differ if type definitions change between versions.

### Mock VFS Path Alias

Tests create a mock TypeScript host with path alias `"@/*": ["./examples/*"]`. This needs updating:

```typescript
// packages/language-service/test/utils/mocks.ts
export function createMockLanguageServiceHost(fileName: string, sourceText: string) {
  const HARNESS = process.env.HARNESS
  if (!HARNESS) throw new Error("HARNESS must be set")

  const HARNESS_ROOT = path.resolve(__dirname, `../../../harness-effect-${HARNESS}`)

  // Path alias now points to harness examples
  const paths = {
    "@/*": [path.join(HARNESS_ROOT, "examples", "*")]
  }
  // ...
}
```

### TypeScript Configuration Hierarchy

The current repo has 7 tsconfig files. After migration:

#### `packages/language-service/`
- `tsconfig.json` - Root with project references
- `tsconfig.base.json` - Shared compiler options
- `tsconfig.src.json` - Source compilation
- `tsconfig.test.json` - Test type-checking
- `tsconfig.build.json` - Production build (stripInternal)
- `tsconfig.config.json` - Build config files (tsup, vitest)

#### `packages/harness-effect-v3/` and `packages/harness-effect-v4/`
- `tsconfig.json` - Type-checks examples only, no emit

```json
// packages/harness-effect-v3/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./examples/*"]
    }
  },
  "include": ["examples"]
}
```

### Changesets Configuration

Update `.changeset/config.json` to ignore harness packages:

```json
{
  "changelog": ["@changesets/changelog-github", { "repo": "Effect-TS/language-service" }],
  "commit": false,
  "access": "restricted",
  "baseBranch": "main",
  "ignore": [
    "@effect/harness-effect-v3",
    "@effect/harness-effect-v4"
  ]
}
```

### ESLint Configuration

The root `eslint.config.mjs` needs workspace-aware ignores:

```javascript
export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "packages/*/dist/**",
      "packages/*/__snapshots__/**"
    ]
  },
  // ... rest of config
]
```

Each harness can share the root config or have minimal overrides.

### Circular Dependency Check (madge)

The `madge` circular dependency check should only run on language-service:

```json
// packages/language-service/package.json
{
  "scripts": {
    "circular": "madge --extensions ts --circular --no-color --no-spinner --warning src"
  }
}
```

Root script delegates:
```json
{
  "scripts": {
    "circular": "pnpm --filter @effect/language-service circular"
  }
}
```

### Example Directory Structure

Each harness has the full example structure (231 files currently):

```
examples/
├── completions/       (26 files)
├── diagnostics/       (114 files)
├── goto/              (2 files)
├── inlays/            (1 file)
├── layer-graph/       (9 files)
├── piping/            (10 files)
├── quickinfo/         (4 files)
├── refactors/         (55 files)
├── renames/           (9 files)
└── utils/             (1 file - shared types)
```

### Snapshot File Naming

Snapshots use complex naming patterns that will be preserved:

```
__snapshots__/
├── diagnostics/
│   ├── {example}.ts.output                           # Diagnostic output
│   ├── {example}.ts.codefixes                        # Available fixes list
│   └── {example}.ts.{fixName}.from{start}to{end}.output  # Fix result
├── refactors/
│   └── {example}.ts.ln{line}col{col}.output          # Refactor at position
├── renames/
│   └── {example}.ts.ln{l1}col{c1}-ln{l2}col{c2}.output
└── ... (other feature snapshots)
```

## Decisions

1. **Shared Examples**: Always duplicate. Each harness has its own copy of all examples - simpler structure even if more files to maintain.

2. **Gradual Migration**: Create the v4 harness structure with empty folders initially, then gradually add examples and support over time.

3. **Effect v4 Version**: Effect v4 is not yet published to npm. Use continuous release from pkg.pr.new:
   ```
   npm i https://pkg.pr.new/Effect-TS/effect-smol/effect@e177d6c
   ```
   Update to stable npm version once v4 is officially released.

4. **Deprecation**: No planned deprecation. Effect v3 support will be maintained indefinitely until explicitly decided otherwise.

5. **CI Execution**: Run v3 and v4 tests sequentially (`pnpm test` runs v3 then v4).
