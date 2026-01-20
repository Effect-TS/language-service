# Nano Patterns and Examples

This document provides practical examples and patterns for using Nano in the Effect Language Service codebase.

## Table of Contents

1. [Basic Patterns](#basic-patterns)
2. [Service Patterns](#service-patterns)
3. [Error Handling Patterns](#error-handling-patterns)
4. [Type Parsing Patterns](#type-parsing-patterns)
5. [Diagnostic Patterns](#diagnostic-patterns)
6. [Refactor Patterns](#refactor-patterns)
7. [Completion Patterns](#completion-patterns)
8. [Performance Patterns](#performance-patterns)

## Basic Patterns


### Conditional Logic

```typescript
const result = Nano.gen(function*() {
  const condition = yield* checkCondition()
  
  if (condition) {
    return yield* handleTrue()
  } else {
    return yield* handleFalse()
  }
})
```

## Service Patterns

### Standard Service Setup

```typescript
export const myOperation = Nano.fn("myOperation")(function*(param: string) {
  // Get all services at the start
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  
  // Use services
  const type = typeChecker.getTypeAtLocation(node)
  // ...
})
```

### Creating Custom Services

```typescript
// Define service interface
export interface ConfigService {
  readonly isDiagnosticEnabled: (name: string) => boolean
  readonly getSeverity: (name: string) => DiagnosticSeverity
}

// Create service tag
export const ConfigService = Nano.Tag<ConfigService>("ConfigService")

// Implement service
const configServiceImpl: ConfigService = {
  isDiagnosticEnabled: (name) => config.diagnostics[name] !== false,
  getSeverity: (name) => config.severity[name] || "error"
}

// Provide service
const result = pipe(
  myOperation(),
  Nano.provideService(ConfigService, configServiceImpl),
  Nano.run
)
```

### Service Layers

```typescript
// Create a layer of common services
const commonServicesLayer = <A, E, R>(nano: Nano<A, E, R>) =>
  pipe(
    nano,
    Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
    Nano.provideService(TypeParser.TypeParser, typeParser)
  )
```

## Error Handling Patterns

### Graceful Degradation

```typescript
const result = yield* pipe(
  tryPrimaryApproach(),
  Nano.orElse(() => tryFallbackApproach()),
  Nano.orElse(() => Nano.succeed(defaultValue))
)
```

### Error Transformation

```typescript
const result = yield* pipe(
  riskyOperation(),
  Nano.match({
    onSuccess: (value) => Nano.succeed(transform(value)),
    onFailure: (error) => Nano.fail(new CustomError(error))
  })
)
```

### Optional Values

```typescript
const maybeResult = yield* Nano.option(
  parseComplexType(type)
)

if (Option.isSome(maybeResult)) {
  // Use maybeResult.value
} else {
  // Handle absence
}
```

### Collecting Errors

```typescript
const errors: Array<string> = []

for (const item of items) {
  const result = yield* Nano.option(processItem(item))
  if (Option.isNone(result)) {
    errors.push(`Failed to process ${item}`)
  }
}
```

## Type Parsing Patterns

### Safe Type Parsing

```typescript
const parseEffectType = Nano.fn("parseEffectType")(function*(type: ts.Type, node: ts.Node) {
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  
  // Try to parse as Effect type
  const effect = yield* Nano.option(typeParser.effectType(type, node))
  
  if (Option.isNone(effect)) {
    return Option.none()
  }
  
  // Extract type parameters
  const [success, error, requirements] = effect.value
  
  return Option.some({
    success,
    error,
    requirements
  })
})
```

### Type Checking Cascade

```typescript
const identifyType = Nano.fn("identifyType")(function*(type: ts.Type) {
  const typeParser = yield* Nano.service(TypeParser.TypeParser)
  
  // Try different type parsers in order
  const asEffect = yield* Nano.option(typeParser.effectType(type))
  if (Option.isSome(asEffect)) return { kind: "effect" as const, value: asEffect.value }
  
  const asLayer = yield* Nano.option(typeParser.layerType(type))
  if (Option.isSome(asLayer)) return { kind: "layer" as const, value: asLayer.value }
  
  const asFiber = yield* Nano.option(typeParser.fiberType(type))
  if (Option.isSome(asFiber)) return { kind: "fiber" as const, value: asFiber.value }
  
  return { kind: "unknown" as const }
})
```
## Performance Patterns

### Caching Type Operations

```typescript
const getEffectType = Nano.cachedBy(
  Nano.fn("getEffectType")(function*(type: ts.Type) {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    return yield* typeParser.effectType(type)
  }),
  "effectTypeCache",
  (type) => type // Use type object as key
)
```

### Early Exit Optimization

```typescript
apply: Nano.fn("optimized.apply")(function*(sourceFile, report) {
  // Quick check before expensive operations
  const hasEffectImport = yield* checkForEffectImport(sourceFile)
  if (!hasEffectImport) {
    return // Skip processing files without Effect
  }
  
  // Proceed with expensive analysis
  yield* performFullAnalysis(sourceFile, report)
})
```

### Batch Operations

```typescript
const processNodes = Nano.fn("processNodes")(function*(nodes: Array<ts.Node>) {
  // Collect all types first
  const types = yield* Nano.all(
    ...nodes.map(node => getNodeType(node))
  )
  
  // Process in batch
  const results = yield* Nano.all(
    ...types.map(type => analyzeType(type))
  )
  
  return results
})
```
