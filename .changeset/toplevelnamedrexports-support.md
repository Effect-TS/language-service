---
"@effect/language-service": minor
---

Added support for `topLevelNamedReexports` configuration option to control how top-level named re-exports are handled when using `namespaceImportPackages`.

- `"ignore"` (default): Named re-exports like `import { pipe } from "effect"` are left as-is
- `"follow"`: Named re-exports are rewritten to their original module, e.g., `import { pipe } from "effect/Function"`

This allows users to have more control over their import style preferences when using namespace imports.