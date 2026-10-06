---
"@effect/language-service": patch
---

`missedPipeableOpportunity` now reports calls whose result is used as a method receiver, and the calls nested inside them. These were skipped before:

```ts
// now reported: `Inner.pipe(...)`
export const B = Schema.NullishOr(Inner).annotations({ identifier: "B" })

// now reported, including the nested `Schema.Array(Inner)`
export const C = Schema.NullishOr(Schema.Struct({ x: Schema.Array(Inner) })).annotations({ identifier: "C" })
```

Other diagnostics built on the same piping analysis, such as `flatMapToMap` and `strictEffectProvide`, now also check calls in these positions.
