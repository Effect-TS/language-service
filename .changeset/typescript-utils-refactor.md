---
"@effect/language-service": minor
---

Extract TypeScript utilities into a dedicated TypeScriptUtils module

This refactoring improves code organization by consolidating TypeScript-related utilities into a separate `TypeScriptUtils` module. The changes include:

- Created new `src/core/TypeScriptUtils.ts` module containing all TypeScript utility functions
- Removed the old `src/core/AST.ts` file which contained scattered utilities
- Updated all imports across the codebase to use the new module structure
- Improved type safety and consistency in TypeScript API interactions
- Enhanced modularity by using the Nano dependency injection pattern

This change maintains backward compatibility while providing better separation of concerns and easier maintenance of TypeScript-related functionality.