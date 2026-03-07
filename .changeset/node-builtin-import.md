---
"@effect/language-service": minor
---

Add the `nodeBuiltinImport` diagnostic to warn when importing Node.js built-in modules (`fs`, `path`, `child_process`) that have Effect-native counterparts in `@effect/platform`.

This diagnostic covers ES module imports and top-level `require()` calls, matching both bare and `node:`-prefixed specifiers as well as subpath variants like `fs/promises`, `path/posix`, and `path/win32`. It defaults to severity `off` and provides no code fixes.
