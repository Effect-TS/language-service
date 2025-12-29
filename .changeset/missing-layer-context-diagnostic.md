---
"@effect/language-service": minor
---

Add `missingLayerContext` diagnostic to detect missing service requirements in Layer definitions

This new diagnostic provides better error readability when you're missing service requirements in your Layer type definitions. It works similarly to the existing `missingEffectContext` diagnostic but specifically checks the `RIn` (requirements input) parameter of Layer types.

Example of code that triggers the diagnostic:
```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

class ServiceA extends Effect.Service<ServiceA>()("ServiceA", {
  succeed: { a: 1 }
}) {}

class ServiceB extends Effect.Service<ServiceB>()("ServiceB", {
  succeed: { a: 2 }
}) {}

declare const layerWithServices: Layer.Layer<ServiceA, never, ServiceB>

function testFn(layer: Layer.Layer<ServiceA>) {
  return layer
}

// ⚠️ Error: Missing 'ServiceB' in the expected Layer context.
testFn(layerWithServices)
```

The diagnostic helps catch type mismatches early by clearly indicating which service requirements are missing when passing layers between functions or composing layers together.
