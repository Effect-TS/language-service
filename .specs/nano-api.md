# Nano Module Specification

## Overview

Nano is a lightweight, Effect-like interface designed specifically for the Effect Language Service plugin. It provides a familiar Effect-style API while avoiding the "Effect-in-Effect" problem that would occur if the language service itself used the full Effect library.

### Key Characteristics

- **Synchronous only** - No async operations
- **Not stack-safe** - Intended for small, bounded computations
- **Effect-like API** - Familiar to Effect users
- **Minimal overhead** - Optimized for IDE performance
- **Service injection** - Dependency management via tags

## Core API

### Basic Operations

#### Creating Nano Values

```typescript
// Success value
Nano.succeed<A>(value: A): Nano<A, never, never>

// Failure value
Nano.fail<E>(error: E): Nano<never, E, never>

// Suspend evaluation
Nano.suspend<A, E, R>(fn: () => Nano<A, E, R>): Nano<A, E, R>

// Sync computation
Nano.sync<A>(f: () => A): Nano<A, never, never>

// Void value
Nano.void_: Nano<void, never, never>
```

#### Transformations

```typescript
// Chain operations
Nano.flatMap<A, B, E2, R2>(
  fa: Nano<A, E, R>,
  f: (a: A) => Nano<B, E2, R2>
): Nano<B, E | E2, R | R2>

// Map success value
Nano.map<A, B>(
  fa: Nano<A, E, R>,
  f: (a: A) => B
): Nano<B, E, R>
```

#### Error Handling

```typescript
// Pattern match on success/failure
Nano.match<A, B, E, R, C, E2, R2, E3, R3>(
  fa: Nano<A, E, R>,
  opts: {
    onSuccess: (a: A) => Nano<B, E2, R2>
    onFailure: (e: E) => Nano<C, E3, R3>
  }
): Nano<B | C, E | E2 | E3, R | R2 | R3>

// Provide fallback on error
Nano.orElse<E, B, E2, R2>(
  f: (e: E) => Nano<B, E2, R2>
): <A, R>(fa: Nano<A, E, R>) => Nano<A | B, E2, R | R2>

// Convert to Option
Nano.option<A, E, R>(fa: Nano<A, E, R>): Nano<Option<A>, never, R>

// Ignore result
Nano.ignore<A, E, R>(fa: Nano<A, E, R>): Nano<void, never, R>

// Try multiple until success
Nano.firstSuccessOf<A>(arr: Array<Nano<A, any, any>>): Nano<A, any, any>
```

### Generator Syntax

#### Basic Generator

```typescript
Nano.gen<Eff, AEff>(
  body: () => Generator<Eff, AEff, never>
): Nano<AEff, E, R>

// Example
const result = Nano.gen(function*() {
  const a = yield* Nano.succeed(1)
  const b = yield* Nano.succeed(2)
  return a + b
})
```

#### Named Generator Functions

```typescript
Nano.fn(name: string)<Eff, AEff, Args>(
  body: (...args: Args) => Generator<Eff, AEff, never>
): (...args: Args) => Nano<AEff, E, R>

// Example
const myFunction = Nano.fn("myFunction")(function*(x: number) {
  const doubled = yield* Nano.sync(() => x * 2)
  return doubled
})
```

### Service Management

#### Defining Services

```typescript
// Create a service tag
const MyService = Nano.Tag<MyService>("MyService")

// Service interface
interface MyService {
  doSomething(): string
}
```

#### Using Services

```typescript
// Get service in generator
const service = yield* Nano.service(MyService)

// Provide service
Nano.provideService(
  MyService,
  { doSomething: () => "result" }
)(nano)
```

### Utility Operations

#### Combining Operations

```typescript
// Run all operations, collecting results
Nano.all<A>(...args: Array<Nano<A, E, R>>): Nano<Array<A>, E, R>
```

#### Caching

```typescript
// Cache results by key
Nano.cachedBy<P, A, E, R>(
  fa: (...p: P) => Nano<A, E, R>,
  type: string,
  lookupKey: (...p: P) => object
): (...p: P) => Nano<A, E, R>
```

### Execution

```typescript
// Run and handle exceptions
Nano.run<A, E>(nano: Nano<A, E, never>): Either<A, E | NanoDefectException>

// Run without exception handling
Nano.unsafeRun<A, E>(nano: Nano<A, E, never>): Either<A, E | NanoDefectException>
```

## Common Patterns

### 1. Service-Based Operations

```typescript
export const myDiagnostic = LSP.createDiagnostic({
  name: "myDiagnostic",
  code: 100,
  severity: "error",
  apply: Nano.fn("myDiagnostic.apply")(function*(sourceFile, report) {
    // Get required services
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    
    // Perform analysis
    const type = typeChecker.getTypeAtLocation(node)
    const effect = yield* Nano.option(typeParser.effectType(type, node))
    
    if (Option.isSome(effect)) {
      report({
        location: node,
        messageText: "Error message",
        fixes: []
      })
    }
  })
})
```

### 2. Error Recovery

```typescript
const result = yield* pipe(
  Nano.suspend(() => riskyOperation()),
  Nano.orElse(() => Nano.succeed(defaultValue)),
  Nano.map(transformResult)
)
```

### 3. Optional Operations

```typescript
// Try to get a value, continue if not found
const maybeValue = yield* Nano.option(
  typeParser.parseComplexType(type)
)

if (Option.isSome(maybeValue)) {
  // Use the value
}
```

### 4. Multiple Attempts

```typescript
const result = yield* Nano.firstSuccessOf([
  tryApproach1(),
  tryApproach2(),
  tryApproach3()
])
```

### 5. Caching Expensive Operations

```typescript
const parseEffectType = Nano.cachedBy(
  Nano.fn("parseEffectType")(function*(type: ts.Type) {
    // Expensive parsing logic
    const result = yield* complexParsing(type)
    return result
  }),
  "effectTypeCache",
  (type) => type // Use type object as cache key
)
```

## Best Practices

### 1. Named Functions

Always use `Nano.fn("descriptiveName")` for better debugging:

```typescript
// Good
apply: Nano.fn("floatingEffect.apply")(function*() { ... })

// Avoid
apply: function*() { ... }
```

### 2. Service Access

Get all services at the beginning of functions:

```typescript
function*(sourceFile) {
  // Get all services first
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
  
  // Then use them
  // ...
}
```

### 3. Error Handling

Use specific error types for clarity:

```typescript
// Define specific errors
export class RefactorNotApplicableError {
  readonly _tag = "@effect/language-service/RefactorNotApplicableError"
}

// Use them
yield* Nano.fail(new RefactorNotApplicableError())
```

### 4. Option for Expected Failures

Use `Nano.option` when failures are expected and acceptable:

```typescript
const effect = yield* Nano.option(typeParser.effectType(type, node))
// No error handling needed - Option.none() indicates not an Effect type
```

### 5. Early Returns

Use early returns with `yield*` for cleaner code:

```typescript
function*() {
  const condition = yield* checkCondition()
  if (!condition) {
    yield* Nano.fail(new Error("Condition not met"))
    return // TypeScript knows this is unreachable
  }
  
  // Continue with logic
}
```

## Implementation Details

### Type Signature

```typescript
interface Nano<out A = never, out E = never, out R = never> {
  readonly "~nano.success": A
  readonly "~nano.error": E
  readonly "~nano.requirements": R
}
```

### Internal Execution

- Uses a fiber-based execution model
- Maintains service registry per execution
- Caches results using WeakMap
- Catches exceptions and converts to defects

### Performance Considerations

- Synchronous execution only
- No stack safety guarantees
- Minimal allocations
- Efficient service lookup
- WeakMap-based caching

## Common Services

### Core Services

1. **TypeScriptApi** - TypeScript compiler API
2. **TypeCheckerApi** - Type checking operations
3. **TypeParser** - Effect type parsing utilities
4. **TypeScriptProgram** - TypeScript program instance
5. **LanguageServicePluginOptions** - Plugin configuration
6. **ChangeTracker** - Code modification tracking
7. **TypeScriptUtils** - Utility functions

### Service Interfaces

Services are typically defined as:

```typescript
export interface MyService {
  // Service methods
}

export const MyService = Nano.Tag<MyService>("MyService")
```

## Debugging

### Common Issues

1. **Missing Service**: Ensure service is provided in the execution context
2. **Type Errors**: Check generator yield types match expected Nano types
3. **Defects**: Uncaught exceptions become NanoDefectException

### Debugging Tips

- Use named functions for stack traces
- Check service provision order
- Log intermediate values in generators
- Verify error handling paths

## Migration from Effect

If migrating from Effect code:

| Effect | Nano |
|--------|------|
| `Effect.succeed` | `Nano.succeed` |
| `Effect.fail` | `Nano.fail` |
| `Effect.gen` | `Nano.gen` |
| `Effect.flatMap` | `Nano.flatMap` |
| `Effect.map` | `Nano.map` |
| `Effect.catchAll` | `Nano.orElse` |
| `Effect.provide` | `Nano.provideService` |
| `Effect.all` | `Nano.all` |
| `Effect.sync` | `Nano.sync` |

Note: Nano lacks many Effect features (async, concurrency, resources, etc.) as it's designed for simple, synchronous computations only.