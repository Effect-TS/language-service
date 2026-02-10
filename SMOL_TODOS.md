# Effect-Smol (v4) Compatibility Tracker

This file tracks all language service features and their compatibility status with effect-smol (Effect v4).

**Legend:**
- [ ] Not tested / Unknown status
- [x] Compatible with effect-smol
- [~] Partially compatible / Needs work
- [-] Not applicable to effect-smol
- [N] v4 only

---

## Diagnostics (47 total)

- [-] effectGenUsesAdapter
- [-] unsupportedServiceAccessors
- [-] schemaUnionOfLiterals
- [-] genericEffectServices
- [-] scopeInLayerEffect
- [-] missingEffectServiceDependency
- [X] floatingEffect
- [X] missingEffectContext
- [X] missingEffectError
- [X] unnecessaryPipe
- [X] unnecessaryPipeChain
- [X] returnEffectInGen
- [X] unnecessaryEffectGen
- [X] duplicatePackage
- [X] globalErrorInEffectFailure
- [X] effectInVoidSuccess
- [X] effectSucceedWithVoid
- [X] effectMapVoid
- [X] tryCatchInEffectGen
- [X] instanceOfSchema
- [X] anyUnknownInErrorContext
- [X] missingStarInYieldEffectGen
- [X] missingReturnYieldStar
- [X] strictBooleanExpressions
- [X] globalErrorInEffectCatch
- [X] preferSchemaOverJson
- [X] catchAllToMapError
- [X] unnecessaryFailYieldableError
- [X] catchUnfailableEffect
- [X] effectFnIife
- [X] schemaStructWithTag
- [X] importFromBarrel
- [X] overriddenSchemaConstructor
- [X] classSelfMismatch
- [X] unknownInEffectCatch
- [X] layerMergeAllWithDependencies
- [-] redundantSchemaTagIdentifier
- [X] effectFnOpportunity
- [ ] leakingRequirements
- [X] multipleEffectProvide
- [ ] outdatedEffectCodegen
- [-] nonObjectEffectServiceType
- [ ] deterministicKeys
- [X] missedPipeableOpportunity
- [ ] strictEffectProvide
- [ ] runEffectInsideEffect
- [ ] missingLayerContext
- [ ] schemaSyncInEffect

---

## Completions (13 total)

- [ ] contextSelfInClasses
- [ ] durationInput
- [ ] effectCodegensComment
- [ ] effectDataClasses
- [X] effectDiagnosticsComment
- [X] effectJsdocComment
- [ ] effectSchemaSelfInClasses
- [ ] effectSelfInClasses
- [ ] effectSqlModelSelfInClasses
- [X] fnFunctionStar
- [X] genFunctionStar
- [ ] rpcMakeClasses
- [ ] schemaBrand

---

## Refactors (21 total)

- [X] asyncAwaitToFn
- [X] asyncAwaitToFnTryPromise
- [X] asyncAwaitToGen
- [X] asyncAwaitToGenTryPromise
- [X] effectGenToFn
- [X] functionToArrow
- [ ] layerMagic
- [ ] makeSchemaOpaque
- [ ] makeSchemaOpaqueWithNs
- [X] pipeableToDatafirst
- [X] removeUnnecessaryEffectGen
- [ ] structuralTypeToSchema
- [X] toggleLazyConst
- [X] togglePipeStyle
- [X] toggleReturnTypeAnnotation
- [X] toggleTypeAnnotation
- [ ] typeToEffectSchema
- [ ] typeToEffectSchemaClass
- [X] wrapWithEffectGen
- [X] wrapWithPipe
- [ ] writeTagClassAccessors
