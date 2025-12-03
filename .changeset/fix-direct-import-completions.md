---
"@effect/language-service": patch
---

Fix auto-completion for directly imported Effect APIs. Completions now work when using direct imports like `import { Service } from "effect/Effect"` instead of only working with fully qualified names like `Effect.Service`.

This fix applies to:
- `Effect.Service` and `Effect.Tag` from `effect/Effect`
- `Schema.Class`, `Schema.TaggedError`, `Schema.TaggedClass`, and `Schema.TaggedRequest` from `effect/Schema`
- `Data.TaggedError` and `Data.TaggedClass` from `effect/Data`
- `Context.Tag` from `effect/Context`

Example:
```typescript
// Now works with direct imports
import { Service } from "effect/Effect"
export class MyService extends Service // ✓ Completion available

// Still works with fully qualified names
import * as Effect from "effect/Effect"
export class MyService extends Effect.Service // ✓ Completion available
```

Fixes #394
