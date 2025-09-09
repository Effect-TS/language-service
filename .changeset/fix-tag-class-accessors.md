---
"@effect/language-service": patch
---

Add support for Effect.Tag in writeTagClassAccessors refactor

The writeTagClassAccessors refactor now supports Effect.Tag classes in addition to Effect.Service and Context.Tag. This allows users to generate accessor methods for services created with Effect.Tag, maintaining consistency across all tag-based service patterns.