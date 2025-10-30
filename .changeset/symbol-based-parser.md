---
"@effect/language-service": minor
---

Refactor TypeParser internals to use symbol-based navigation instead of type-based navigation

This change improves the reliability and performance of the TypeParser by switching from type-based navigation to symbol-based navigation when identifying Effect, Schema, and other Effect ecosystem APIs. The new implementation:

- Uses TypeScript's symbol resolution APIs to accurately identify imports and references
- Supports package name resolution to verify that identifiers actually reference the correct packages
- Implements proper alias resolution for imported symbols
- Adds caching for source file package information lookups
- Provides new helper methods like `isNodeReferenceToEffectModuleApi` and `isNodeReferenceToEffectSchemaModuleApi`

This is an internal refactoring that doesn't change the public API or functionality, but provides a more robust foundation for the language service features.