# Effect-Smol (v4) Compatibility Tracker

This file tracks all language service features and their compatibility status with effect-smol (Effect v4).

**Legend:**
- [ ] Not tested / Unknown status
- [x] Compatible with effect-smol
- [~] Partially compatible / Needs work
- [-] Not applicable to effect-smol

---

## Diagnostics (47 total)

- [-] effectGenUsesAdapter
- [-] unsupportedServiceAccessors
- [-] schemaUnionOfLiterals
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
- [ ] leakingRequirements
- [-] genericEffectServices
- [ ] scopeInLayerEffect
- [ ] multipleEffectProvide
- [ ] outdatedEffectCodegen
- [ ] missingEffectServiceDependency
- [ ] nonObjectEffectServiceType
- [ ] deterministicKeys
- [ ] missedPipeableOpportunity
- [ ] strictEffectProvide
- [ ] unknownInEffectCatch
- [ ] runEffectInsideEffect
- [ ] layerMergeAllWithDependencies
- [ ] missingLayerContext
- [ ] effectFnOpportunity
- [ ] redundantSchemaTagIdentifier
- [ ] schemaSyncInEffect

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
