---
"@effect/language-service": minor
---

Add `overview` CLI command that provides an overview of Effect-related exports in a project.

The command analyzes TypeScript files and reports all exported yieldable errors, services (Context.Tag, Effect.Tag, Effect.Service), and layers with their types, file locations, and JSDoc descriptions. A progress spinner shows real-time file processing status.

Usage:
```bash
effect-language-service overview --file path/to/file.ts
effect-language-service overview --project tsconfig.json
```

Example output:
```
✔ Processed 3 file(s)
Overview for 3 file(s).

Yieldable Errors (1)
  NotFoundError
    ./src/errors.ts:5:1
    NotFoundError

Services (2)
  DbConnection
    ./src/services/db.ts:6:1
    Manages database connections

Layers (1)
  AppLive
    ./src/layers/app.ts:39:14
    Layer<Cache | UserRepository, never, never>
```
