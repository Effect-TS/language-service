---
"@effect/language-service": minor
---

Improve `effectFnOpportunity` inferred span naming for service-layer methods and align examples for Effect v4.

The inferred span can now include service + method names (for example `MyService.log`) when the convertible function is a method inside a layer service object for strict supported patterns like:

- `Layer.succeed(Service)(...)`
- `Layer.sync(Service)(...)`
- `Layer.effect(Service)(Effect.gen(...))`
- `Layer.effect(Service, Effect.gen(...))`

Also add Effect v4 diagnostics fixtures for:

- `effectFnOpportunity_inferred.ts`
- `effectFnOpportunity_inferredLayer.ts`

