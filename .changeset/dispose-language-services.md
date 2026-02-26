---
"@effect/language-service": patch
---

Dispose TypeScript language services in tests to prevent resource leaks

Added `languageService.dispose()` calls via `try/finally` patterns to all test files that create language services through `createServicesWithMockedVFS()`. This ensures proper cleanup of TypeScript compiler resources after each test completes, preventing memory leaks during test runs.
