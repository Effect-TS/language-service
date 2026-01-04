---
"@effect/language-service": patch
---

Fix auto-import with namespace import packages generating malformed code when the identifier is at the beginning of the file.

When using `namespaceImportPackages` configuration and auto-completing an export like `isAnyKeyword` from `effect/SchemaAST`, the code was incorrectly generated as:

```ts
SchemaAST.import * as SchemaAST from "effect/SchemaAST";
```

Instead of the expected:

```ts
import * as SchemaAST from "effect/SchemaAST";

SchemaAST.isAnyKeyword
```

The fix ensures the import statement is added before the namespace prefix when both changes target position 0.
