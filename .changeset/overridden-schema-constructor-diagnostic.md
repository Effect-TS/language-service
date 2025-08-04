---
"@effect/language-service": minor
---

Add new diagnostic to warn when schema classes override the default constructor behavior

The new diagnostic helps catch cases where schema classes define custom constructors that might break the expected schema behavior. Example:

```ts
import { Schema } from "effect"

class MySchema extends Schema.Class<MySchema>("MySchema")({
  value: Schema.String
}) {
  // This will trigger a warning
  constructor(props: { value: string }) {
    super(props)
  }
}
```

The diagnostic provides quickfixes to either:
- Remove the constructor
- Suppress the warning for the current line
- Suppress the warning for the entire file