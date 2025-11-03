import { catchUnfailableEffect } from "./diagnostics/catchUnfailableEffect.js"
import { classSelfMismatch } from "./diagnostics/classSelfMismatch.js"
import { deterministicKeys } from "./diagnostics/deterministicKeys.js"
import { duplicatePackage } from "./diagnostics/duplicatePackage.js"
import { effectGenUsesAdapter } from "./diagnostics/effectGenUsesAdapter.js"
import { effectInVoidSuccess } from "./diagnostics/effectInVoidSuccess.js"
import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { genericEffectServices } from "./diagnostics/genericEffectServices.js"
import { importFromBarrel } from "./diagnostics/importFromBarrel.js"
import { leakingRequirements } from "./diagnostics/leakingRequirements.js"
import { missedPipeableOpportunity } from "./diagnostics/missedPipeableOpportunity.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingEffectServiceDependency } from "./diagnostics/missingEffectServiceDependency.js"
import { missingReturnYieldStar } from "./diagnostics/missingReturnYieldStar.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { multipleEffectProvide } from "./diagnostics/multipleEffectProvide.js"
import { nonObjectEffectServiceType } from "./diagnostics/nonObjectEffectServiceType.js"
import { outdatedEffectCodegen } from "./diagnostics/outdatedEffectCodegen.js"
import { overriddenSchemaConstructor } from "./diagnostics/overriddenSchemaConstructor.js"
import { returnEffectInGen } from "./diagnostics/returnEffectInGen.js"
import { scopeInLayerEffect } from "./diagnostics/scopeInLayerEffect.js"
import { strictBooleanExpressions } from "./diagnostics/strictBooleanExpressions.js"
import { strictEffectProvide } from "./diagnostics/strictEffectProvide.js"
import { tryCatchInEffectGen } from "./diagnostics/tryCatchInEffectGen.js"
import { unknownInEffectCatch } from "./diagnostics/unknownInEffectCatch.js"
import { unnecessaryEffectGen } from "./diagnostics/unnecessaryEffectGen.js"
import { unnecessaryPipe } from "./diagnostics/unnecessaryPipe.js"
import { unnecessaryPipeChain } from "./diagnostics/unnecessaryPipeChain.js"
import { unsupportedServiceAccessors } from "./diagnostics/unsupportedServiceAccessors.js"

export const diagnostics = [
  catchUnfailableEffect,
  classSelfMismatch,
  duplicatePackage,
  effectGenUsesAdapter,
  missingEffectContext,
  missingEffectError,
  missingEffectServiceDependency,
  floatingEffect,
  missingStarInYieldEffectGen,
  unnecessaryEffectGen,
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
  unknownInEffectCatch
]
