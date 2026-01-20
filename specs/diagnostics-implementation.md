# Diagnostics Implementation Specification

## Overview

The Effect Language Service provides a comprehensive diagnostic system that analyzes Effect-based TypeScript code and reports errors, warnings, and suggestions to help developers write correct and idiomatic Effect code.

## Architecture

### Core Components

1. **Diagnostic Definition Interface** (`LSP.DiagnosticDefinition`)
   - `name`: Unique identifier for the diagnostic
   - `code`: Numeric error code (must be unique)
   - `severity`: One of "error", "warning", "message", "suggestion", or "off"
   - `apply`: Function that performs the analysis and reports issues

2. **Central Registry** (`src/diagnostics.ts`)
   - Exports an array of all diagnostic definitions
   - Currently includes 22 diagnostics
   - New diagnostics must be added to this array

3. **Individual Diagnostic Files** (`src/diagnostics/*.ts`)
   - Each diagnostic is implemented in its own file
   - Follows naming convention matching the diagnostic name
   - Imports necessary utilities from core modules

## Implementation Pattern

### Basic Structure

```typescript
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
// ... other imports

export const diagnosticName = LSP.createDiagnostic({
  name: "diagnosticName",
  code: <unique_number>,
  severity: "error" | "warning" | "message" | "suggestion",
  apply: Nano.fn("diagnosticName.apply")(function*(sourceFile, report) {
    // Diagnostic implementation
  })
})
```

### Key Services Available

Within the `apply` function, you can access:

1. **TypeScript API** (`TypeScriptApi.TypeScriptApi`)
   - Access to TypeScript compiler APIs
   - AST traversal and manipulation

2. **Type Checker** (`TypeCheckerApi.TypeCheckerApi`)
   - Type information for nodes
   - Symbol resolution

3. **Type Parser** (`TypeParser.TypeParser`)
   - Effect-specific type parsing utilities
   - Methods like `effectType()`, `layerType()`, etc.

4. **Plugin Options** (`LanguageServicePluginOptions`)
   - User configuration
   - Package lists for specific rules

5. **TypeScript Utilities** (`TypeScriptUtils`)
   - Helper functions for common operations

### Reporting Issues

Use the `report` function to report diagnostics:

```typescript
report({
  location: node,              // TypeScript AST node or TextRange
  messageText: "Error message",
  fixes: []                    // Array of quick fixes
})
```

### Quick Fixes

Quick fixes follow the `ApplicableDiagnosticDefinitionFix` interface:

```typescript
{
  fixName: string,
  description: string,
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}
```

## Testing Framework

### Test Structure

1. **Test File**: `test/diagnostics.test.ts`
   - Automatically discovers and tests all diagnostics
   - Runs two test suites per diagnostic:
     - Diagnostic detection
     - Quick fix application

2. **Example Files**: `examples/diagnostics/`
   - Naming convention:
     - `diagnosticName.ts` - Basic example
     - `diagnosticName_variant.ts` - Specific variants
   - Contains code that should trigger the diagnostic

3. **Snapshot Files**: `test/__snapshots__/diagnostics/`
   - `.output` - Expected diagnostic messages
   - `.codefixes` - List of available fixes
   - Individual fix files - Results of applying each fix

### Testing Process

1. Test runner reads example files
2. Applies diagnostic to the file
3. Captures diagnostic messages and locations
4. Formats output with line/column information
5. Compares against snapshots

### Adding Tests

1. Create example file in `examples/diagnostics/`
2. Run tests to generate initial snapshots
3. Review snapshots for correctness
4. Commit both example and snapshot files

## Configuration

### User Configuration

Diagnostics can be configured via TypeScript plugin options:

```json
{
  "plugins": [{
    "name": "@effect/language-service",
    "diagnostics": true,
    "diagnosticSeverity": {
      "diagnosticName": "warning",
      "anotherDiagnostic": "off"
    }
  }]
}
```

## Implementation Guidelines

### 1. Performance Considerations

- Use efficient AST traversal patterns
- Avoid unnecessary type checking operations
- Cache computed values when possible
- Use `Nano.option` for operations that may fail

### 2. Error Messages

- Be clear and concise
- Explain what's wrong and why
- Suggest how to fix the issue
- Include relevant type information when helpful

### 3. AST Traversal

Common patterns:

```typescript
// Recursive traversal
const nodeToVisit: Array<ts.Node> = []
const appendNodeToVisit = (node: ts.Node) => {
  nodeToVisit.push(node)
  return undefined
}

ts.forEachChild(sourceFile, appendNodeToVisit)
while (nodeToVisit.length > 0) {
  const node = nodeToVisit.shift()!
  ts.forEachChild(node, appendNodeToVisit)
  // Process node
}
```

### 4. Type Checking

Use TypeParser utilities for Effect types:

```typescript
const type = typeChecker.getTypeAtLocation(node)
const effect = yield* Nano.option(typeParser.effectType(type, node))
if (Option.isSome(effect)) {
  // Handle Effect type
}
```

## Adding a New Diagnostic

### Step-by-Step Process

1. **Create Diagnostic File**
   ```bash
   touch src/diagnostics/myNewDiagnostic.ts
   ```

2. **Implement Diagnostic**
   - Use `LSP.createDiagnostic`
   - Choose unique error code
   - Implement analysis logic
   - Add quick fixes if applicable

3. **Register Diagnostic**
   - Import in `src/diagnostics.ts`
   - Add to `diagnostics` array

4. **Create Test Examples**
   ```bash
   touch examples/diagnostics/myNewDiagnostic.ts
   ```

5. **Run Tests**
   ```bash
   pnpm test
   ```

6. **Review Snapshots**
   - Check generated snapshots
   - Ensure output is correct

7. **Update Documentation**
   - Add to README.md if user-facing

### Code Review Checklist

- [ ] Unique error code
- [ ] Clear error messages
- [ ] Efficient implementation
- [ ] Comprehensive test coverage
- [ ] Quick fixes tested
- [ ] Documentation updated
- [ ] No performance regressions

## Common Patterns

### Checking for Effect Types

```typescript
const type = typeChecker.getTypeAtLocation(node)
const effect = yield* Nano.option(typeParser.effectType(type, node))
```

### Creating Quick Fixes

```typescript
fixes: [{
  fixName: "addYieldStar",
  description: "Add yield*",
  apply: Nano.sync(function() {
    const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
    changeTracker.replaceNode(sourceFile, node, newNode)
  })
}]
```
