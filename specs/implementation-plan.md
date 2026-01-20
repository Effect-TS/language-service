# Multi-Version Support Implementation Plan

This document provides a detailed implementation plan with phases, tasks, and acceptance criteria for restructuring the Effect Language Service repository to support both Effect v3 and Effect v4 as described in `multi-version-support.md`.

## Current State Summary

Based on codebase analysis:

- **Repository Structure**: Single-package structure with `src/`, `test/`, `examples/`, `__snapshots__/` at root level
- **Test Infrastructure**: Vitest with file-based snapshots; examples read via `__dirname` relative paths
- **CI Workflows**: 4 workflows (check.yml, test.yml, build.yml, snapshot.yml) configured for single-package
- **Configuration**: 5 tsconfig files with project references, no `pnpm-workspace.yaml`
- **Effect Dependencies**: effect@3.19.14, @effect/platform, @effect/sql, @effect/rpc, @effect/cli, etc.
- **Test Files**: 231 example files, 976+ snapshot files across diagnostics/refactors/completions/etc.

---

## Phase 1: Repository Restructure

**Goal**: Transform the repository into a pnpm workspace monorepo structure while maintaining all existing functionality.

### Task 1.1: Create packages directory structure

**Description**: Create the `packages/` directory and `packages/language-service/` subdirectory.

**Steps**:
1. Create `packages/` directory at repository root
2. Create `packages/language-service/` directory

**Acceptance Criteria**:
- [ ] `packages/` directory exists at root
- [ ] `packages/language-service/` directory exists

---

### Task 1.2: Move source code to packages/language-service/src/

**Description**: Move the entire `src/` directory to `packages/language-service/src/`.

**Steps**:
1. Move `src/` to `packages/language-service/src/`
2. Verify all files are present (49 diagnostics, 14 completions, 21 refactors, CLI, core modules)

**Acceptance Criteria**:
- [ ] `packages/language-service/src/` contains all source files
- [ ] Directory structure preserved (cli/, core/, diagnostics/, completions/, refactors/, etc.)
- [ ] Original `src/` directory no longer exists at root

---

### Task 1.3: Move test logic to packages/language-service/test/

**Description**: Move test files to `packages/language-service/test/`.

**Steps**:
1. Move `test/*.test.ts` files to `packages/language-service/test/`
2. Move `test/utils/` to `packages/language-service/test/utils/`
3. Move `test/perf.ts` to `packages/language-service/test/`

**Acceptance Criteria**:
- [ ] All test files moved to `packages/language-service/test/`
- [ ] `test/utils/mocks.ts` preserved in new location
- [ ] Original `test/` directory only contains files that will be moved later (snapshots)

---

### Task 1.4: Create pnpm-workspace.yaml

**Description**: Create workspace configuration file at repository root.

**Steps**:
1. Create `pnpm-workspace.yaml` with packages glob pattern

**Content**:
```yaml
packages:
  - "packages/*"
```

**Acceptance Criteria**:
- [ ] `pnpm-workspace.yaml` exists at root
- [ ] Contains correct packages glob pattern
- [ ] `pnpm install` recognizes workspace structure

---

### Task 1.5: Create packages/language-service/package.json

**Description**: Create package.json for the language-service package.

**Steps**:
1. Create `packages/language-service/package.json`
2. Include all devDependencies from root package.json
3. Configure scripts for build, lint, check, test
4. Set up publishing configuration

**Key Configuration**:
```json
{
  "name": "@effect/language-service",
  "version": "0.71.0",
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
    "circular": "madge --extensions ts --circular --no-color --no-spinner --warning src",
    "clean": "rm -rf dist"
  },
  "publishConfig": {
    "access": "public",
    "directory": "dist"
  }
}
```

**Acceptance Criteria**:
- [ ] Package.json created with correct name and version
- [ ] All necessary devDependencies included (effect, typescript, vitest, tsup, etc.)
- [ ] Scripts defined for build, lint, check, test, clean, circular
- [ ] Publishing configuration set correctly

---

### Task 1.6: Move TypeScript configuration files

**Description**: Move and update TypeScript configuration files for the language-service package.

**Steps**:
1. Move relevant tsconfig files to `packages/language-service/`
2. Create new root `tsconfig.json` with project references
3. Update paths and references in all tsconfig files

**Files to Create/Update**:

**`packages/language-service/tsconfig.json`** (root orchestrator):
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false
  },
  "references": [
    { "path": "tsconfig.src.json" },
    { "path": "tsconfig.test.json" },
    { "path": "tsconfig.config.json" }
  ]
}
```

**`packages/language-service/tsconfig.base.json`** (shared options):
- Keep existing compiler options
- Remove references to examples (will be in harnesses)

**`packages/language-service/tsconfig.src.json`** (source):
- Include: `src/**/*`
- Output to `build/src`

**`packages/language-service/tsconfig.test.json`** (tests):
- Include: `test/**/*`
- Reference: `tsconfig.src.json`
- noEmit: true

**`packages/language-service/tsconfig.config.json`** (build config):
- Include: `tsup.config.ts`, `vitest.config.mts`
- noEmit: true

**Root `tsconfig.json`**:
```json
{
  "files": [],
  "references": [
    { "path": "packages/language-service" },
    { "path": "packages/harness-effect-v3" },
    { "path": "packages/harness-effect-v4" }
  ]
}
```

**Acceptance Criteria**:
- [ ] `packages/language-service/tsconfig*.json` files created and valid
- [ ] Root `tsconfig.json` references all packages
- [ ] `pnpm check` passes from root and from packages/language-service
- [ ] No circular references in tsconfig structure

---

### Task 1.7: Move build configuration files

**Description**: Move tsup.config.ts and vitest.config.mts to packages/language-service/.

**Steps**:
1. Move `tsup.config.ts` to `packages/language-service/`
2. Move `vitest.config.mts` to `packages/language-service/`
3. Update paths in both files
4. Move `.madgerc` to `packages/language-service/`

**Acceptance Criteria**:
- [ ] `packages/language-service/tsup.config.ts` exists and works
- [ ] `packages/language-service/vitest.config.mts` exists and works
- [ ] `pnpm build` works from packages/language-service
- [ ] `pnpm test` works from packages/language-service (will be updated later for harness)

---

### Task 1.8: Update root package.json

**Description**: Transform root package.json into a workspace orchestrator.

**Content**:
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
    "circular": "pnpm --filter @effect/language-service circular",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "@changesets/cli": "^2.29.8"
  },
  "packageManager": "pnpm@8.11.0"
}
```

**Acceptance Criteria**:
- [ ] Root package.json is private
- [ ] Scripts delegate to workspace packages
- [ ] Only changesets as devDependency at root
- [ ] packageManager field preserved

---

### Task 1.9: Update ESLint configuration

**Description**: Update ESLint configuration for workspace structure.

**Steps**:
1. Keep root `eslint.config.mjs` as shared configuration
2. Update ignore patterns for workspace structure
3. Each package can extend or use root config

**Updated ignores**:
```javascript
ignores: [
  "**/dist/**",
  "**/build/**",
  "**/node_modules/**",
  "packages/*/dist/**",
  "packages/*/__snapshots__/**"
]
```

**Acceptance Criteria**:
- [ ] ESLint config updated for workspace paths
- [ ] `pnpm lint` works from root (runs across all packages)
- [ ] `pnpm lint` works from packages/language-service

---

### Task 1.10: Update changeset configuration

**Description**: Update .changeset/config.json for workspace structure.

**Updates**:
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

**Acceptance Criteria**:
- [ ] Harness packages listed in ignore array
- [ ] Changesets only track @effect/language-service
- [ ] `pnpm changeset` works correctly

---

### Task 1.11: Verify Phase 1 completion

**Description**: Run all checks to verify the restructure is complete and working.

**Verification Steps**:
1. Run `pnpm install` from root
2. Run `pnpm check` from root
3. Run `pnpm lint` from root
4. Run `pnpm build` from root
5. Verify dist/ output in packages/language-service/

**Acceptance Criteria**:
- [ ] `pnpm install` succeeds
- [ ] `pnpm check` passes with no type errors
- [ ] `pnpm lint` passes with no lint errors
- [ ] `pnpm build` produces dist/ output
- [ ] Package can be published (dry-run)

---

## Phase 2: Create v3 Harness

**Goal**: Create the harness-effect-v3 package with existing examples and snapshots.

### Task 2.1: Create harness-effect-v3 package structure

**Description**: Create the directory structure for the v3 harness package.

**Steps**:
1. Create `packages/harness-effect-v3/`
2. Create subdirectories: `examples/`, `__snapshots__/`

**Acceptance Criteria**:
- [ ] `packages/harness-effect-v3/` directory exists
- [ ] `examples/` subdirectory exists
- [ ] `__snapshots__/` subdirectory exists

---

### Task 2.2: Move examples to harness-effect-v3

**Description**: Move all example files to the v3 harness.

**Steps**:
1. Move `examples/diagnostics/` to `packages/harness-effect-v3/examples/diagnostics/`
2. Move `examples/completions/` to `packages/harness-effect-v3/examples/completions/`
3. Move `examples/refactors/` to `packages/harness-effect-v3/examples/refactors/`
4. Move `examples/renames/` to `packages/harness-effect-v3/examples/renames/`
5. Move `examples/piping/` to `packages/harness-effect-v3/examples/piping/`
6. Move `examples/goto/` to `packages/harness-effect-v3/examples/goto/`
7. Move `examples/inlays/` to `packages/harness-effect-v3/examples/inlays/`
8. Move `examples/quickinfo/` to `packages/harness-effect-v3/examples/quickinfo/`
9. Move `examples/layer-graph/` to `packages/harness-effect-v3/examples/layer-graph/`
10. Move `examples/utils/` to `packages/harness-effect-v3/examples/utils/`

**Acceptance Criteria**:
- [ ] All 231 example files moved to v3 harness
- [ ] Directory structure preserved (diagnostics/, completions/, etc.)
- [ ] Original `examples/` directory removed from root
- [ ] No broken file references

---

### Task 2.3: Move snapshots to harness-effect-v3

**Description**: Move all snapshot files to the v3 harness.

**Steps**:
1. Move `test/__snapshots__/diagnostics/` to `packages/harness-effect-v3/__snapshots__/diagnostics/`
2. Move `test/__snapshots__/refactors/` to `packages/harness-effect-v3/__snapshots__/refactors/`
3. Move `test/__snapshots__/renames/` to `packages/harness-effect-v3/__snapshots__/renames/`
4. Move `test/__snapshots__/piping/` to `packages/harness-effect-v3/__snapshots__/piping/`
5. Move `test/__snapshots__/layer-graph/` to `packages/harness-effect-v3/__snapshots__/layer-graph/`
6. Move `test/__snapshots__/layerinfo/` to `packages/harness-effect-v3/__snapshots__/layerinfo/`
7. Move `test/__snapshots__/overview/` to `packages/harness-effect-v3/__snapshots__/overview/`
8. Move remaining `.snap` files to appropriate locations

**Acceptance Criteria**:
- [ ] All 976+ snapshot files moved to v3 harness
- [ ] Directory structure preserved
- [ ] Original `test/__snapshots__/` directory removed

---

### Task 2.4: Create harness-effect-v3 package.json

**Description**: Create package.json for the v3 harness with Effect v3 dependencies.

**Content**:
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
    "@effect/platform": "^0.94.1",
    "@effect/sql": "^0.49.0",
    "@effect/rpc": "^0.73.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "eslint": "^9.39.2"
  }
}
```

**Acceptance Criteria**:
- [ ] Package.json created with correct dependencies
- [ ] Package is marked as private
- [ ] Effect v3 version specified correctly
- [ ] All @effect/* packages at v3-compatible versions

---

### Task 2.5: Create harness-effect-v3 tsconfig.json

**Description**: Create TypeScript configuration for the v3 harness.

**Content**:
```json
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

**Acceptance Criteria**:
- [ ] tsconfig.json created in harness-effect-v3
- [ ] Path alias configured for @/* imports
- [ ] noEmit set to true (type-checking only)
- [ ] `pnpm check` passes for harness

---

### Task 2.6: Update test files for HARNESS environment variable

**Description**: Modify test files to read examples and snapshots from harness directories based on HARNESS env var.

**Files to Update**:
- `packages/language-service/test/diagnostics.test.ts`
- `packages/language-service/test/completions.test.ts`
- `packages/language-service/test/refactors.test.ts`
- `packages/language-service/test/renames.test.ts`
- `packages/language-service/test/piping-flows.test.ts`
- `packages/language-service/test/layer-graph.test.ts`
- `packages/language-service/test/layerinfo.test.ts`
- `packages/language-service/test/overview.test.ts`
- `packages/language-service/test/cli-diagnostics.test.ts`

**Pattern to implement**:
```typescript
const HARNESS = process.env.HARNESS
if (!HARNESS) throw new Error("HARNESS environment variable must be set (v3 or v4)")

const HARNESS_ROOT = path.resolve(__dirname, `../../harness-effect-${HARNESS}`)
const EXAMPLES_DIR = path.join(HARNESS_ROOT, "examples")
const SNAPSHOTS_DIR = path.join(HARNESS_ROOT, "__snapshots__")

// Use EXAMPLES_DIR instead of path.join(__dirname, "..", "examples", ...)
// Use SNAPSHOTS_DIR instead of path.join(__dirname, "__snapshots__", ...)
```

**Acceptance Criteria**:
- [ ] All test files updated to use HARNESS env var
- [ ] Tests fail with clear error if HARNESS not set
- [ ] Tests correctly resolve paths to harness directories
- [ ] `HARNESS=v3 pnpm test` passes all tests

---

### Task 2.7: Update test/utils/mocks.ts for harness paths

**Description**: Update the mock utilities to use harness-based path aliases.

**Updates**:
```typescript
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

**Acceptance Criteria**:
- [ ] mocks.ts updated to use HARNESS env var
- [ ] Path aliases resolve to correct harness directory
- [ ] Tests using mocks work correctly with harness

---

### Task 2.8: Update vitest.config.mts for harness support

**Description**: Update vitest configuration if needed for harness environment.

**Steps**:
1. Ensure vitest can receive HARNESS env var
2. Update test patterns if necessary
3. Configure snapshot paths if needed

**Acceptance Criteria**:
- [ ] Vitest works with HARNESS=v3
- [ ] Snapshot comparisons use correct harness paths
- [ ] `pnpm test-update` updates snapshots in correct harness

---

### Task 2.9: Verify Phase 2 completion

**Description**: Run all tests with v3 harness to verify everything works.

**Verification Steps**:
1. Run `pnpm install` from root
2. Run `pnpm check` from root
3. Run `HARNESS=v3 pnpm --filter @effect/language-service test`
4. Verify all tests pass
5. Verify snapshot comparison works

**Acceptance Criteria**:
- [ ] All workspace packages install successfully
- [ ] Type checking passes for all packages
- [ ] All v3 tests pass
- [ ] Snapshot updates work correctly

---

## Phase 3: Create v4 Harness (Empty Structure)

**Goal**: Create the harness-effect-v4 package with empty structure for gradual population.

### Task 3.1: Create harness-effect-v4 package structure

**Description**: Create the directory structure for the v4 harness package.

**Steps**:
1. Create `packages/harness-effect-v4/`
2. Create all example subdirectories (empty)
3. Create all snapshot subdirectories (empty)

**Directory Structure**:
```
packages/harness-effect-v4/
├── examples/
│   ├── diagnostics/
│   ├── completions/
│   ├── refactors/
│   ├── renames/
│   ├── piping/
│   ├── goto/
│   ├── inlays/
│   ├── quickinfo/
│   ├── layer-graph/
│   └── utils/
├── __snapshots__/
│   ├── diagnostics/
│   ├── refactors/
│   ├── renames/
│   ├── piping/
│   ├── layer-graph/
│   ├── layerinfo/
│   └── overview/
├── package.json
└── tsconfig.json
```

**Acceptance Criteria**:
- [ ] All directories created
- [ ] Structure mirrors v3 harness
- [ ] Directories can be empty (placeholder .gitkeep if needed)

---

### Task 3.2: Create harness-effect-v4 package.json

**Description**: Create package.json for the v4 harness with Effect v4 dependency.

**Content**:
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
    "effect": "https://pkg.pr.new/Effect-TS/effect-smol/effect@e177d6c"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "eslint": "^9.39.2"
  }
}
```

**Note**: Effect v4 is not on npm yet, use pkg.pr.new continuous release URL.

**Acceptance Criteria**:
- [ ] Package.json created with Effect v4 dependency
- [ ] Package is marked as private
- [ ] pkg.pr.new URL for effect v4 specified
- [ ] Other @effect/* packages can be added as v4 versions become available

---

### Task 3.3: Create harness-effect-v4 tsconfig.json

**Description**: Create TypeScript configuration for the v4 harness.

**Content**:
```json
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

**Acceptance Criteria**:
- [ ] tsconfig.json created in harness-effect-v4
- [ ] Configuration matches v3 harness
- [ ] Type-checking only (noEmit: true)

---

### Task 3.4: Create placeholder files for v4 harness

**Description**: Create minimal placeholder files so the harness can be used.

**Steps**:
1. Create `packages/harness-effect-v4/examples/utils/types.ts` with shared types
2. Create `.gitkeep` files in empty directories if needed

**Acceptance Criteria**:
- [ ] utils/types.ts exists with basic exports
- [ ] `pnpm install` works for v4 harness
- [ ] `pnpm check` passes for v4 harness (with empty examples)

---

### Task 3.5: Update test configuration for v4

**Description**: Ensure tests can run against v4 harness even with empty/partial examples.

**Steps**:
1. Update test files to handle missing examples gracefully
2. Tests should skip if no example files found for a diagnostic

**Pattern**:
```typescript
if (exampleFiles.length === 0) {
  it.skip(`${diagnostic.name} (no v4 examples)`, () => {})
  return
}
```

**Acceptance Criteria**:
- [ ] `HARNESS=v4 pnpm test` runs without error
- [ ] Tests skip gracefully when no examples exist
- [ ] Test output indicates skipped tests clearly

---

### Task 3.6: Verify Phase 3 completion

**Description**: Verify the v4 harness structure is complete and usable.

**Verification Steps**:
1. Run `pnpm install` from root
2. Run `pnpm check` (all packages)
3. Run `HARNESS=v4 pnpm --filter @effect/language-service test`
4. Verify tests skip correctly for missing examples

**Acceptance Criteria**:
- [ ] v4 harness installs successfully
- [ ] v4 harness type-checks successfully
- [ ] v4 tests run and skip as expected
- [ ] No errors when running v4 test suite

---

## Phase 4: CI Configuration

**Goal**: Update GitHub Actions workflows and CI configuration for the monorepo structure.

### Task 4.1: Update check.yml workflow

**Description**: Update the check workflow for workspace structure.

**Changes**:
```yaml
# No changes needed - pnpm -r check and pnpm -r lint work automatically
- run: pnpm check
- run: pnpm lint
```

**Acceptance Criteria**:
- [ ] Workflow runs `pnpm check` successfully
- [ ] Workflow runs `pnpm lint` successfully
- [ ] All packages type-checked

---

### Task 4.2: Update test.yml workflow

**Description**: Update the test workflow to run both v3 and v4 tests.

**Changes**:
```yaml
- run: pnpm test
# This runs: pnpm test:v3 && pnpm test:v4
```

**Acceptance Criteria**:
- [ ] Workflow runs v3 tests successfully
- [ ] Workflow runs v4 tests (skipping missing examples)
- [ ] Both test runs complete without error

---

### Task 4.3: Update build.yml workflow

**Description**: Update the build workflow for workspace structure.

**Changes**:
```yaml
- run: pnpm build
# Now runs: pnpm --filter @effect/language-service build

- run: git add packages && git diff-index --cached HEAD --exit-code packages
# Updated path from src to packages

- run: pnpm circular
# Now runs: pnpm --filter @effect/language-service circular
```

**Acceptance Criteria**:
- [ ] Build workflow produces dist/ in packages/language-service/
- [ ] Git check verifies no generated files in packages/
- [ ] Circular dependency check works on packages/language-service/src

---

### Task 4.4: Update snapshot.yml workflow

**Description**: Update the snapshot publishing workflow for workspace structure.

**Changes**:
```yaml
- run: pnpm build
- run: git add packages && git diff-index --cached HEAD --exit-code packages
- run: pnpm circular
- run: pnpx pkg-pr-new@0.0.28 publish --pnpm --comment=off ./packages/language-service/dist
# Updated path from ./dist to ./packages/language-service/dist
```

**Acceptance Criteria**:
- [ ] Snapshot publishing uses correct dist path
- [ ] pkg-pr-new publishes from packages/language-service/dist
- [ ] Snapshot releases work correctly

---

### Task 4.5: Update root tsconfig.json references

**Description**: Ensure root tsconfig.json references all packages for type-checking.

**Content**:
```json
{
  "files": [],
  "references": [
    { "path": "packages/language-service" },
    { "path": "packages/harness-effect-v3" },
    { "path": "packages/harness-effect-v4" }
  ]
}
```

**Acceptance Criteria**:
- [ ] Root tsconfig.json references all packages
- [ ] `tsc -b` from root builds all packages
- [ ] Incremental compilation works across packages

---

### Task 4.6: Verify CI Configuration

**Description**: Run a complete CI simulation locally.

**Verification Steps**:
1. Run `pnpm check` (simulates check.yml)
2. Run `pnpm lint` (simulates check.yml)
3. Run `pnpm test` (simulates test.yml - v3 and v4)
4. Run `pnpm build` (simulates build.yml)
5. Run `pnpm circular` (simulates build.yml)
6. Verify all commands succeed

**Acceptance Criteria**:
- [ ] All CI commands pass locally
- [ ] No regressions from current behavior
- [ ] Both Effect versions tested

---

## Phase 5: Documentation and Cleanup

**Goal**: Update documentation and clean up any remaining issues.

### Task 5.1: Update README.md

**Description**: Update README with new workspace structure and commands.

**Updates**:
- Document workspace structure
- Update development commands
- Add v3/v4 testing instructions
- Document harness usage

**Acceptance Criteria**:
- [ ] README reflects new structure
- [ ] Development workflow documented
- [ ] Testing commands documented

---

### Task 5.2: Clean up old files

**Description**: Remove any files that were moved or are no longer needed at root.

**Steps**:
1. Remove old `src/` directory (if any remains)
2. Remove old `test/` directory (if any remains)
3. Remove old `examples/` directory
4. Remove old `tsconfig.examples.json`
5. Clean up any other obsolete files

**Acceptance Criteria**:
- [ ] No duplicate files exist
- [ ] Root directory is clean
- [ ] Only workspace orchestration at root

---

### Task 5.3: Final verification

**Description**: Complete end-to-end verification of the monorepo.

**Verification Steps**:
1. Fresh `pnpm install`
2. `pnpm check` (all packages)
3. `pnpm lint` (all packages)
4. `pnpm build` (language-service)
5. `pnpm test` (v3 and v4)
6. Verify publishable package in packages/language-service/dist

**Acceptance Criteria**:
- [ ] Clean install works
- [ ] All checks pass
- [ ] All tests pass (v3 full, v4 partial)
- [ ] Package builds correctly
- [ ] Ready for CI pipeline

---

## Summary of Phases

| Phase | Tasks | Goal |
|-------|-------|------|
| **Phase 1** | 11 tasks | Repository restructure to monorepo |
| **Phase 2** | 9 tasks | Create v3 harness with existing content |
| **Phase 3** | 6 tasks | Create v4 harness empty structure |
| **Phase 4** | 6 tasks | Update CI configuration |
| **Phase 5** | 3 tasks | Documentation and cleanup |

**Total: 35 tasks**

## Risk Mitigation

1. **Incremental commits**: Commit after each task for easy rollback
2. **Test at each phase**: Verify tests pass before proceeding
3. **Preserve git history**: Use `git mv` for moves when possible
4. **Backup**: Create a branch before starting restructure

## Dependencies Between Phases

- Phase 2 depends on Phase 1 completion
- Phase 3 can start after Phase 2 Task 2.6 (test file updates)
- Phase 4 can run in parallel with Phase 3
- Phase 5 depends on all other phases
