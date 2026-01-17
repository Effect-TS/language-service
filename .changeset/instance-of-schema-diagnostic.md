---
"@effect/language-service": minor
---

Added `instanceOfSchema` diagnostic that suggests using `Schema.is` instead of `instanceof` for Effect Schema types.

Example:
```typescript
import { Schema } from "effect"

const MySchema = Schema.Struct({ name: Schema.String })

// Before - triggers diagnostic
if (value instanceof MySchema) { ... }

// After - using Schema.is
if (Schema.is(MySchema)(value)) { ... }
```

The diagnostic is disabled by default and can be enabled with `instanceOfSchema:suggestion` or `instanceOfSchema:warning`.
