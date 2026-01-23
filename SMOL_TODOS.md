# Effect-Smol (v4) Compatibility Tracker

This file tracks all language service features and their compatibility status with effect-smol (Effect v4).

**Legend:**
- [ ] Not tested / Unknown status
- [x] Compatible with effect-smol
- [~] Partially compatible / Needs work
- [-] Not applicable to effect-smol

---

## Diagnostics (47 total)

- [X] floatingEffect
- [X] missingEffectContext
- [X] missingEffectError
- [X] unnecessaryPipe
- [X] unnecessaryPipeChain
- [X] returnEffectInGen
- [X] unnecessaryEffectGen
- [-] effectGenUsesAdapter
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
- [ ] catchUnfailableEffect
- [ ] leakingRequirements
- [ ] genericEffectServices
- [ ] importFromBarrel
- [ ] scopeInLayerEffect
- [ ] strictBooleanExpressions
- [ ] multipleEffectProvide
- [ ] outdatedEffectCodegen
- [ ] classSelfMismatch
- [ ] unsupportedServiceAccessors
- [ ] missingEffectServiceDependency
- [ ] nonObjectEffectServiceType
- [ ] deterministicKeys
- [ ] missedPipeableOpportunity
- [ ] strictEffectProvide
- [ ] unnecessaryFailYieldableError
- [ ] overriddenSchemaConstructor
- [ ] unknownInEffectCatch
- [ ] runEffectInsideEffect
- [ ] schemaUnionOfLiterals
- [ ] schemaStructWithTag
- [ ] globalErrorInEffectCatch
- [ ] layerMergeAllWithDependencies
- [ ] missingLayerContext
- [ ] catchAllToMapError
- [ ] effectFnOpportunity
- [ ] redundantSchemaTagIdentifier
- [ ] schemaSyncInEffect
- [ ] preferSchemaOverJson
- [ ] effectFnIife

---

## Completions (13 total)

- [ ] contextSelfInClasses
- [ ] durationInput
- [ ] effectCodegensComment
- [ ] effectDataClasses
- [ ] effectDiagnosticsComment
- [ ] effectJsdocComment
- [ ] effectSchemaSelfInClasses
- [ ] effectSelfInClasses
- [ ] effectSqlModelSelfInClasses
- [ ] fnFunctionStar
- [ ] genFunctionStar
- [ ] rpcMakeClasses
- [ ] schemaBrand

---

## Refactors (21 total)

- [ ] asyncAwaitToFn
- [ ] asyncAwaitToFnTryPromise
- [ ] asyncAwaitToGen
- [ ] asyncAwaitToGenTryPromise
- [ ] effectGenToFn
- [ ] functionToArrow
- [ ] layerMagic
- [ ] makeSchemaOpaque
- [ ] makeSchemaOpaqueWithNs
- [ ] pipeableToDatafirst
- [ ] removeUnnecessaryEffectGen
- [ ] structuralTypeToSchema
- [ ] toggleLazyConst
- [ ] togglePipeStyle
- [ ] toggleReturnTypeAnnotation
- [ ] toggleTypeAnnotation
- [ ] typeToEffectSchema
- [ ] typeToEffectSchemaClass
- [ ] wrapWithEffectGen
- [ ] wrapWithPipe
- [ ] writeTagClassAccessors
