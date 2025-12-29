---
"@effect/language-service": patch
---

fix: ensure correct path resolution in CLI setup

- Use `process.cwd()` explicitly in `path.resolve()` for consistent behavior
- Resolve the selected tsconfig path to an absolute path before validation
- Simplify error handling by using direct `yield*` for `TsConfigNotFoundError`
