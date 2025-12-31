---
"@effect/language-service": patch
---

Improve diagnostic message for `unsupportedServiceAccessors` when used with `Effect.Tag`

When the `unsupportedServiceAccessors` diagnostic is triggered on an `Effect.Tag` class (which doesn't allow disabling accessors), the message now includes a helpful suggestion to use `Context.Tag` instead:

```typescript
export class MyService extends Effect.Tag("MyService")<MyService, {
  method: <A>(value: A) => Effect.Effect<A>
}>() {}
// Diagnostic: Even if accessors are enabled, accessors for 'method' won't be available 
// because the signature have generic type parameters or multiple call signatures.
// Effect.Tag does not allow to disable accessors, so you may want to use Context.Tag instead.
```
