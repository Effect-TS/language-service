---
"@effect/language-service": patch
---

fix: resolve TypeScript from project's working directory

The CLI now attempts to resolve TypeScript from the current working directory first before falling back to the package's bundled version. This ensures the CLI uses the same TypeScript version as the project being analyzed.
