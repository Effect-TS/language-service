---
"@effect/language-service": minor
---

Add refactor to convert `Effect.Service` to `Context.Tag` with a static `Layer` property.

Supports all combinator kinds (`effect`, `scoped`, `sync`, `succeed`) and `dependencies`. The refactor replaces the `Effect.Service` class declaration with a `Context.Tag` class that has a `static layer` property using the corresponding `Layer` combinator.

Before:
```ts
export class MyService extends Effect.Service<MyService>()("MyService", {
  effect: Effect.gen(function*() {
    return { value: "hello" }
  })
}){}
```

After:
```ts
export class MyService extends Context.Tag("MyService")<MyService, { value: string }>() {
  static layer = Layer.effect(this, Effect.gen(function*() {
    return { value: "hello" }
  }));
}
```
