---
"@effect/language-service": minor
---

Add support for Effect diagnostics

With this release of the language service plugin, we aim to improve the overall Effect experience by providing additional diagnostics that tries to fix misleading or hard to read TypeScript errors.

All of the diagnostics provided by the language service are available only in editor-mode, that means that they won't show up when using tsc.

Diagnostics are enabled by default, but you can opt-out of them by changing the language service configuration and provide diagnostics: false.

```json
{
  "plugins": [
    {
      "name": "@effect/language-service",
      "diagnostics": false
    }
  ]
}
```

Please report any false positive or missing diagnostic you encounter over the Github repository.

## Missing Errors and Services in Effects

Additionally to the standard TypeScript error that may be cryptic at first:

```
Argument of type 'Effect<number, never, ServiceB | ServiceA | ServiceC>' is not assignable to parameter of type 'Effect<number, never, ServiceB | ServiceA>' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Type 'ServiceB | ServiceA | ServiceC' is not assignable to type 'ServiceB | ServiceA'.
    Type 'ServiceC' is not assignable to type 'ServiceB | ServiceA'.
      Type 'ServiceC' is not assignable to type 'ServiceA'.
        Types of property 'a' are incompatible.
          Type '3' is not assignable to type '1'.ts(2379)
```

you'll now receive an additional error:

```
Missing 'ServiceC' in the expected Effect context.
```

## Floating Effect

In some situation you may not receive any compile error at all, but that's because you may have forgot to yield your effects inside gen!

Floating Effects that are not assigned to a variable will be reported into the Effect diagnostics.

```ts
Effect.runPromise(
  Effect.gen(function* () {
    Effect.sync(() => console.log("Hello!"));
    // ^- Effect must be yielded or assigned to a variable.
  })
);
```

## Used yield instead of yield\*

Similarly, yield instead of yield\* won't result in a type error by itself, but is not the intended usage.

This yield will be reported in the effect diagnostics.

```ts
Effect.runPromise(
  Effect.gen(function* () {
    yield Effect.sync(() => console.log("Hello!"));
    // ^- When yielding Effects inside Effect.gen, you should use yield* instead of yield.
  })
);
```
