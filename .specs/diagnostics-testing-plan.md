# Diagnostic Testing Plan

## Overview

This document outlines the comprehensive testing strategy for Effect Language Service diagnostics.

## Test Infrastructure

### Automated Test Suite

The diagnostic testing is fully automated through `test/diagnostics.test.ts` which:

1. **Discovers all diagnostics** from the central registry
2. **Finds corresponding examples** in `examples/diagnostics/`
3. **Runs two test types** per diagnostic:
   - Diagnostic detection tests
   - Quick fix application tests
4. **Generates/validates snapshots** for reproducible results

### Test Execution Flow

```
1. Read diagnostic definition
2. Find example files (diagnosticName*.ts)
3. Create mock TypeScript services
4. Apply diagnostic to example
5. Capture diagnostic output
6. Test each quick fix
7. Compare with snapshots
```

## Testing Scenarios

### 1. Basic Functionality Testing

**Purpose**: Verify diagnostic correctly identifies issues

**Test Cases**:
- Positive cases (should report diagnostic)
- Negative cases (should not report)
- Edge cases
- Multiple occurrences

**Example Structure**:
```typescript
// examples/diagnostics/floatingEffect.ts
import * as Effect from "effect/Effect"

// Should trigger diagnostic
Effect.succeed("floating")

// Should not trigger
const assigned = Effect.succeed("assigned")
```

### 2. Quick Fix Testing

**Purpose**: Ensure fixes produce correct code

**Test Cases**:
- Fix application produces valid code
- Fix preserves formatting
- Fix handles edge cases
- Multiple fixes work correctly

**Verification**:
- Snapshot comparison
- TypeScript compilation of fixed code
- No new diagnostics introduced


### Example File Naming

```
diagnosticName.ts              # Basic test case
diagnosticName_variant.ts      # Specific variant
diagnosticName_edgeCase.ts     # Edge case testing
diagnosticName_disabled.ts     # Configuration testing
```

### Snapshot Structure

```
__snapshots__/diagnostics/
├── diagnosticName.ts.output                    # Diagnostic messages
├── diagnosticName.ts.codefixes                 # Available fixes list
├── diagnosticName.ts.fixName.from0to10.output  # Fix result
└── ...
```

## Writing Effective Tests

### 1. Minimal Reproducible Examples

Keep test files focused:
```typescript
// Good: Focused on specific issue
import * as Effect from "effect/Effect"
Effect.succeed(1) // Clear what's being tested

// Bad: Too much unrelated code
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
// ... lots of setup code
Effect.succeed(1) // Issue buried in noise
```

### 2. Clear Test Boundaries

Mark expected diagnostics:
```typescript
Effect.succeed(1)
// ^-- Expected: "Effect must be yielded or assigned"

const ok = Effect.succeed(1)
// ^-- No diagnostic expected
```

### 3. Comprehensive Coverage

Test matrix:
- Different node types (expressions, statements, declarations)
- Different contexts (top-level, function body, class body)
- Type variations (generic, concrete, union types)
- Fix variations (different approaches)

## Regression Testing

### Process

1. **Bug Report**: Diagnostic misses case or false positive
2. **Create Test**: Add failing example
3. **Fix Implementation**: Update diagnostic
4. **Verify**: Test now passes
5. **Commit**: Include test with fix

### Example Regression Test

```typescript
// examples/diagnostics/floatingEffect_regression123.ts
// Regression test for issue #123
Effect.fork(Effect.succeed(1))
// ^-- Should not report (returns Fiber)
```


## Continuous Integration

### GitHub Actions Workflow

```yaml
- Run all diagnostic tests
- Check snapshot changes
- Measure performance
- Report coverage
```

### Pre-commit Hooks

```bash
pnpm test           # Run all tests
pnpm lint-fix       # Fix formatting
pnpm check          # Type check
```


## Test Maintenance

### Regular Tasks

1. **Review snapshots** when updating diagnostics
2. **Update examples** when APIs change
3. **Add tests** for reported issues
4. **Remove obsolete tests** for deprecated features
5. **Monitor performance** trends

### Version Updates

When updating dependencies:
1. Run full test suite
2. Review any snapshot changes
3. Update examples if needed
4. Document breaking changes
