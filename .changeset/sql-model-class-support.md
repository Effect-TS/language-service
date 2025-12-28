---
"@effect/language-service": minor
---

Add support for `@effect/sql`'s `Model.Class` in completions and diagnostics

- Added `effectSqlModelSelfInClasses` completion: Auto-completes the `Self` type parameter when extending `Model.Class` from `@effect/sql`
- Extended `classSelfMismatch` diagnostic: Now detects when the `Self` type parameter in `Model.Class<Self>` doesn't match the actual class name

Example:
```ts
import { Model } from "@effect/sql"
import * as Schema from "effect/Schema"

// Completion triggers after "Model." to generate the full class boilerplate
export class User extends Model.Class<User>("User")({
  id: Schema.String
}) {}

// Diagnostic warns when Self type parameter doesn't match class name
export class User extends Model.Class<WrongName>("User")({
//                                    ^^^^^^^^^ Self type should be "User"
  id: Schema.String
}) {}
```
