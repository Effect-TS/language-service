---
"@effect/language-service": patch
---

Add support for `Model.Class` from `effect/unstable/schema` in completions and diagnostics.

The `classSelfMismatch` diagnostic now detects mismatched Self type parameters in `Model.Class` declarations, and the autocomplete for Self type in classes now suggests `Model.Class` when typing after `Model.`.

```ts
import { Model } from "effect/unstable/schema"

// autocomplete triggers after `Model.`
export class MyDataModel extends Model.Class<MyDataModel>("MyDataModel")({
  id: Schema.String
}) {}
```
