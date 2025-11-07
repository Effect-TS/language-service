---
"@effect/language-service": patch
---

Fixed `@effect-diagnostics-next-line` comment directive to properly work with diagnostics on property assignments within object literals. Previously, the directive would not suppress diagnostics for properties in the middle of an object literal.
