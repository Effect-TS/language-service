---
"@effect/language-service": patch
---

Fix regression in type unification for union types and prevent infinite recursion in layerMagic refactor

- Fixed `toggleTypeAnnotation` refactor to properly unify boolean types instead of expanding them to `true | false`
- Fixed infinite recursion issue in `layerMagic` refactor's `adjustedNode` function when processing variable and property declarations
