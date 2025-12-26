---
"@effect/language-service": patch
---

Add `getTypeAtLocation` utility to `TypeCheckerUtils`

This refactoring adds a new `getTypeAtLocation` function to `TypeCheckerUtils` that safely retrieves types while filtering out JSX-specific nodes (JSX elements, opening/closing tags, and JSX attributes) that could cause issues when calling `typeChecker.getTypeAtLocation`.

The utility is now used across multiple diagnostics and features, reducing code duplication and ensuring consistent handling of edge cases:
- `anyUnknownInErrorContext`
- `catchUnfailableEffect`
- `floatingEffect`
- `globalErrorInEffectFailure`
- `leakingRequirements`
- `missedPipeableOpportunity`
- `missingEffectServiceDependency`
- `missingReturnYieldStar`
- `multipleEffectProvide`
- `nonObjectEffectServiceType`
- `overriddenSchemaConstructor`
- `returnEffectInGen`
- `scopeInLayerEffect`
- `strictBooleanExpressions`
- `strictEffectProvide`
- `unnecessaryFailYieldableError`
- And other features like quick info, goto definition, and refactors
