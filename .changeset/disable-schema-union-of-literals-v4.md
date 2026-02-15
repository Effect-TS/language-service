---
"@effect/language-service": patch
---

Disable `schemaUnionOfLiterals` diagnostic for Effect v4, as `Schema.Union` of multiple `Schema.Literal` calls is no longer applicable in v4.
