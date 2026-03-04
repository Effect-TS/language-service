---
"@effect/language-service": patch
---

Fix `effectFnOpportunity` inferred span naming for `Layer.*(this, ...)` patterns in class static members.

When the inferred layer target is `this`, the diagnostic now uses the nearest enclosing class name (for example `MyService`) instead of the literal `this` token.
