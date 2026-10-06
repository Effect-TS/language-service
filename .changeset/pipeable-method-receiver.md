---
"@effect/language-service": patch
---

`missedPipeableOpportunity` now reports calls whose result is used as a method receiver, and the calls nested inside them. Before, `TypeParser.pipingFlows` never visited the callee of a single-argument call, so these were skipped:

```ts
// now reported: `Inner.pipe(...)`
export const B = Schema.NullishOr(Inner).annotations({ identifier: "B" })

// now reported, including the nested `Schema.Array(Inner)`
export const C = Schema.NullishOr(Schema.Struct({ x: Schema.Array(Inner) })).annotations({ identifier: "C" })
```
