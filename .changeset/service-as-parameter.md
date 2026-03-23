---
"@effect/language-service": minor
---

Add serviceAsParameter diagnostic

Flags when a yielded service is passed as an argument to an effectful callee instead of letting the callee yield it from context. Uses symbol identity tracking, only flags `const` bindings, skips Layer construction.

```ts
// flagged
const db = yield* Database
yield* processOrder(order, db)

// preferred
yield* processOrder(order)
```
