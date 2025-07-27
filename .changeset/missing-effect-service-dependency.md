---
"@effect/language-service": minor
---

Add missingEffectServiceDependency diagnostic

This diagnostic warns when an `Effect.Service` declaration has missing service dependencies. It checks if all services used within the service's effect are properly declared in the dependencies array.

Example:
```ts
// This will show a warning because SampleService1 is used but not declared in dependencies
export class InvalidService extends Effect.Service<InvalidService>()("InvalidService", {
  effect: Effect.gen(function*() {
    const sampleService1 = yield* SampleService1
    return {
      constant: Effect.succeed(sampleService1.value)
    }
  })
  // Missing: dependencies: [SampleService1.Default]
}) {}
```