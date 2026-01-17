import { anyUnknownInErrorContext } from "./diagnostics/anyUnknownInErrorContext.js"
import { catchAllToMapError } from "./diagnostics/catchAllToMapError.js"
import { catchUnfailableEffect } from "./diagnostics/catchUnfailableEffect.js"
import { classSelfMismatch } from "./diagnostics/classSelfMismatch.js"
import { deterministicKeys } from "./diagnostics/deterministicKeys.js"
import { duplicatePackage } from "./diagnostics/duplicatePackage.js"
import { effectFnOpportunity } from "./diagnostics/effectFnOpportunity.js"
import { effectGenUsesAdapter } from "./diagnostics/effectGenUsesAdapter.js"
import { effectInVoidSuccess } from "./diagnostics/effectInVoidSuccess.js"
import { effectMapVoid } from "./diagnostics/effectMapVoid.js"
import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { genericEffectServices } from "./diagnostics/genericEffectServices.js"
import { globalErrorInEffectCatch } from "./diagnostics/globalErrorInEffectCatch.js"
import { globalErrorInEffectFailure } from "./diagnostics/globalErrorInEffectFailure.js"
import { importFromBarrel } from "./diagnostics/importFromBarrel.js"
import { instanceOfSchema } from "./diagnostics/instanceOfSchema.js"
import { layerMergeAllWithDependencies } from "./diagnostics/layerMergeAllWithDependencies.js"
import { leakingRequirements } from "./diagnostics/leakingRequirements.js"
import { missedPipeableOpportunity } from "./diagnostics/missedPipeableOpportunity.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingEffectServiceDependency } from "./diagnostics/missingEffectServiceDependency.js"
import { missingLayerContext } from "./diagnostics/missingLayerContext.js"
import { missingReturnYieldStar } from "./diagnostics/missingReturnYieldStar.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { multipleEffectProvide } from "./diagnostics/multipleEffectProvide.js"
import { nonObjectEffectServiceType } from "./diagnostics/nonObjectEffectServiceType.js"
import { outdatedEffectCodegen } from "./diagnostics/outdatedEffectCodegen.js"
import { overriddenSchemaConstructor } from "./diagnostics/overriddenSchemaConstructor.js"
import { preferSchemaOverJson } from "./diagnostics/preferSchemaOverJson.js"
import { redundantSchemaTagIdentifier } from "./diagnostics/redundantSchemaTagIdentifier.js"
import { returnEffectInGen } from "./diagnostics/returnEffectInGen.js"
import { runEffectInsideEffect } from "./diagnostics/runEffectInsideEffect.js"
import { schemaStructWithTag } from "./diagnostics/schemaStructWithTag.js"
import { schemaSyncInEffect } from "./diagnostics/schemaSyncInEffect.js"
import { schemaUnionOfLiterals } from "./diagnostics/schemaUnionOfLiterals.js"
import { scopeInLayerEffect } from "./diagnostics/scopeInLayerEffect.js"
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
  anyUnknownInErrorContext,
  instanceOfSchema,
  catchAllToMapError,
  catchUnfailableEffect,
  classSelfMismatch,
  duplicatePackage,
  effectGenUsesAdapter,
  missingEffectContext,
  missingEffectError,
  missingEffectServiceDependency,
  missingLayerContext,
  floatingEffect,
  missingStarInYieldEffectGen,
  unnecessaryEffectGen,
  unnecessaryFailYieldableError,
  missingReturnYieldStar,
  leakingRequirements,
  unnecessaryPipe,
  genericEffectServices,
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
  effectFnOpportunity,
  redundantSchemaTagIdentifier,
  schemaSyncInEffect,
  preferSchemaOverJson
]
