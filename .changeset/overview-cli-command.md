---
"@effect/language-service": minor
---

Add `overview` CLI command that provides an overview of Effect-related exports in a project.

The command analyzes TypeScript files and reports all exported services (Context.Tag, Effect.Tag, Effect.Service) and layers with their types, file locations, and JSDoc descriptions.

Usage:
```bash
effect-language-service overview --file path/to/file.ts
effect-language-service overview --project tsconfig.json
```

Example output:
```
Overview for 1 file(s).

Services (4)
  DbConnection
  │ ./src/services/db.ts:6:1
  │ Manages database connections

Layers (2)
  AppLive
  │ ./src/layers/app.ts:39:14
  │ Layer<Cache | UserRepository, never, never>
  │ Complete application layer
```
