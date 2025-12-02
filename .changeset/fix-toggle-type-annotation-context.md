---
"@effect/language-service": patch
---

Fix type annotation context resolution in toggle refactors. When toggling type annotations or return type annotations, the refactors now correctly use the enclosing declaration node as context instead of the local node, which improves type resolution and prevents issues with type parameter scope.
