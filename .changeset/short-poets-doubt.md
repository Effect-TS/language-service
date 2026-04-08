---
"@effect/language-service": minor
---

Add the `unnecessaryArrowBlock` style diagnostic for arrow functions whose block body only returns an expression.

Example:

```ts
const trim = (value: string) => {
  return value.trim()
}
```
