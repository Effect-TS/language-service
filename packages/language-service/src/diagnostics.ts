import { anyUnknownInErrorContext } from "./diagnostics/anyUnknownInErrorContext.js"
import { asyncFunction } from "./diagnostics/asyncFunction.js"
import { catchAllToMapError } from "./diagnostics/catchAllToMapError.js"
import { catchUnfailableEffect } from "./diagnostics/catchUnfailableEffect.js"
import { classSelfMismatch } from "./diagnostics/classSelfMismatch.js"
import { cryptoRandomUUID } from "./diagnostics/cryptoRandomUUID.js"
import { cryptoRandomUUIDInEffect } from "./diagnostics/cryptoRandomUUIDInEffect.js"
import { deterministicKeys } from "./diagnostics/deterministicKeys.js"
import { duplicatePackage } from "./diagnostics/duplicatePackage.js"
import { effectFnIife } from "./diagnostics/effectFnIife.js"
import { effectFnImplicitAny } from "./diagnostics/effectFnImplicitAny.js"
import { effectFnOpportunity } from "./diagnostics/effectFnOpportunity.js"
import { effectGenUsesAdapter } from "./diagnostics/effectGenUsesAdapter.js"
import { effectInFailure } from "./diagnostics/effectInFailure.js"
import { effectInVoidSuccess } from "./diagnostics/effectInVoidSuccess.js"
import { effectMapVoid } from "./diagnostics/effectMapVoid.js"
import { effectSucceedWithVoid } from "./diagnostics/effectSucceedWithVoid.js"
import { extendsNativeError } from "./diagnostics/extendsNativeError.js"
import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { genericEffectServices } from "./diagnostics/genericEffectServices.js"
import { globalConsole } from "./diagnostics/globalConsole.js"
import { globalConsoleInEffect } from "./diagnostics/globalConsoleInEffect.js"
import { globalDate } from "./diagnostics/globalDate.js"
import { globalDateInEffect } from "./diagnostics/globalDateInEffect.js"
import { globalErrorInEffectCatch } from "./diagnostics/globalErrorInEffectCatch.js"
import { globalErrorInEffectFailure } from "./diagnostics/globalErrorInEffectFailure.js"
import { globalFetch } from "./diagnostics/globalFetch.js"
import { globalFetchInEffect } from "./diagnostics/globalFetchInEffect.js"
import { globalRandom } from "./diagnostics/globalRandom.js"
import { globalRandomInEffect } from "./diagnostics/globalRandomInEffect.js"
import { globalTimers } from "./diagnostics/globalTimers.js"
import { globalTimersInEffect } from "./diagnostics/globalTimersInEffect.js"
import { importFromBarrel } from "./diagnostics/importFromBarrel.js"
import { instanceOfSchema } from "./diagnostics/instanceOfSchema.js"
import { layerMergeAllWithDependencies } from "./diagnostics/layerMergeAllWithDependencies.js"
import { lazyPromiseInEffectSync } from "./diagnostics/lazyPromiseInEffectSync.js"
import { leakingRequirements } from "./diagnostics/leakingRequirements.js"
import { missedPipeableOpportunity } from "./diagnostics/missedPipeableOpportunity.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingEffectServiceDependency } from "./diagnostics/missingEffectServiceDependency.js"
import { missingLayerContext } from "./diagnostics/missingLayerContext.js"
import { missingReturnYieldStar } from "./diagnostics/missingReturnYieldStar.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { multipleEffectProvide } from "./diagnostics/multipleEffectProvide.js"
import { newPromise } from "./diagnostics/newPromise.js"
import { nodeBuiltinImport } from "./diagnostics/nodeBuiltinImport.js"
import { nonObjectEffectServiceType } from "./diagnostics/nonObjectEffectServiceType.js"
import { outdatedApi } from "./diagnostics/outdatedApi.js"
import { outdatedEffectCodegen } from "./diagnostics/outdatedEffectCodegen.js"
import { overriddenSchemaConstructor } from "./diagnostics/overriddenSchemaConstructor.js"
import { preferSchemaOverJson } from "./diagnostics/preferSchemaOverJson.js"
import { processEnv } from "./diagnostics/processEnv.js"
import { processEnvInEffect } from "./diagnostics/processEnvInEffect.js"
import { redundantSchemaTagIdentifier } from "./diagnostics/redundantSchemaTagIdentifier.js"
import { returnEffectInGen } from "./diagnostics/returnEffectInGen.js"
import { runEffectInsideEffect } from "./diagnostics/runEffectInsideEffect.js"
import { schemaStructWithTag } from "./diagnostics/schemaStructWithTag.js"
import { schemaSyncInEffect } from "./diagnostics/schemaSyncInEffect.js"
import { schemaUnionOfLiterals } from "./diagnostics/schemaUnionOfLiterals.js"
import { scopeInLayerEffect } from "./diagnostics/scopeInLayerEffect.js"
import { serviceNotAsClass } from "./diagnostics/serviceNotAsClass.js"
import { strictBooleanExpressions } from "./diagnostics/strictBooleanExpressions.js"
import { strictEffectProvide } from "./diagnostics/strictEffectProvide.js"
import { tryCatchInEffectGen } from "./diagnostics/tryCatchInEffectGen.js"
import { unknownInEffectCatch } from "./diagnostics/unknownInEffectCatch.js"
import { unnecessaryEffectGen } from "./diagnostics/unnecessaryEffectGen.js"
import { unnecessaryFailYieldableError } from "./diagnostics/unnecessaryFailYieldableError.js"
import { unnecessaryPipe } from "./diagnostics/unnecessaryPipe.js"
import { unnecessaryPipeChain } from "./diagnostics/unnecessaryPipeChain.js"
import { unsupportedServiceAccessors } from "./diagnostics/unsupportedServiceAccessors.js"

export const diagnostics = [
  outdatedApi,
  anyUnknownInErrorContext,
  asyncFunction,
  instanceOfSchema,
  catchAllToMapError,
  catchUnfailableEffect,
  classSelfMismatch,
  cryptoRandomUUID,
  cryptoRandomUUIDInEffect,
  duplicatePackage,
  effectFnImplicitAny,
  effectGenUsesAdapter,
  missingEffectContext,
  missingEffectError,
  missingEffectServiceDependency,
  missingLayerContext,
  floatingEffect,
  effectInFailure,
  missingStarInYieldEffectGen,
  newPromise,
  lazyPromiseInEffectSync,
  unnecessaryEffectGen,
  unnecessaryFailYieldableError,
  missingReturnYieldStar,
  leakingRequirements,
  unnecessaryPipe,
  genericEffectServices,
  globalFetch,
  globalFetchInEffect,
  processEnv,
  processEnvInEffect,
  returnEffectInGen,
  tryCatchInEffectGen,
  importFromBarrel,
  scopeInLayerEffect,
  effectInVoidSuccess,
  unnecessaryPipeChain,
  strictBooleanExpressions,
  multipleEffectProvide,
  outdatedEffectCodegen,
  overriddenSchemaConstructor,
  unsupportedServiceAccessors,
  nonObjectEffectServiceType,
  deterministicKeys,
  missedPipeableOpportunity,
  strictEffectProvide,
  unknownInEffectCatch,
  runEffectInsideEffect,
  schemaUnionOfLiterals,
  schemaStructWithTag,
  globalErrorInEffectCatch,
  globalErrorInEffectFailure,
  layerMergeAllWithDependencies,
  effectMapVoid,
  effectSucceedWithVoid,
  effectFnIife,
  effectFnOpportunity,
  redundantSchemaTagIdentifier,
  schemaSyncInEffect,
  preferSchemaOverJson,
  extendsNativeError,
  serviceNotAsClass,
  nodeBuiltinImport,
  globalDate,
  globalDateInEffect,
  globalConsole,
  globalConsoleInEffect,
  globalRandom,
  globalRandomInEffect,
  globalTimers,
  globalTimersInEffect
]
