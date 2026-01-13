---
"@effect/language-service": patch
---

Mark deprecated TypeScript Signature methods and migrate to property accessors

Added `@deprecated` annotations to TypeScript Signature interface methods (`getParameters`, `getTypeParameters`, `getDeclaration`, `getReturnType`, `getTypeParameterAtPosition`) with guidance to use their modern property alternatives. Updated codebase usage of `getParameters()` to use `.parameters` property instead.
