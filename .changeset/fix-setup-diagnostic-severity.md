---
"@effect/language-service": patch
---

Fix TypeError in setup command when updating existing diagnosticSeverity configuration

The setup command was throwing `TypeError: Cannot read properties of undefined (reading 'text')` when trying to update the `diagnosticSeverity` option of an existing `@effect/language-service` plugin configuration in tsconfig.json.

This occurred because TypeScript's ChangeTracker formatter needed to compute indentation by traversing the AST tree, which failed when replacing a PropertyAssignment node inside a nested list context.

The fix replaces just the initializer value (ObjectLiteralExpression) instead of the entire PropertyAssignment, avoiding the problematic list indentation calculation.
