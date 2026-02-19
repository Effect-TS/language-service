---
"@effect/language-service": patch
---

Fix TypeParser to skip types with generic call signatures. When parsing covariant, contravariant, or invariant types, signatures with type parameters are now correctly rejected instead of being treated as concrete types.
