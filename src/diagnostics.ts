import { classSelfMismatch } from "./diagnostics/classSelfMismatch.js"
import { duplicatePackage } from "./diagnostics/duplicatePackage.js"
import { effectInVoidSuccess } from "./diagnostics/effectInVoidSuccess.js"
import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { genericEffectServices } from "./diagnostics/genericEffectServices.js"
import { importFromBarrel } from "./diagnostics/importFromBarrel.js"
import { leakingRequirements } from "./diagnostics/leakingRequirements.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingReturnYieldStar } from "./diagnostics/missingReturnYieldStar.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { multipleEffectProvide } from "./diagnostics/multipleEffectProvide.js"
import { outdatedEffectCodegen } from "./diagnostics/outdatedEffectCodegen.js"
import { returnEffectInGen } from "./diagnostics/returnEffectInGen.js"
import { scopeInLayerEffect } from "./diagnostics/scopeInLayerEffect.js"
import { strictBooleanExpressions } from "./diagnostics/strictBooleanExpressions.js"
import { tryCatchInEffectGen } from "./diagnostics/tryCatchInEffectGen.js"
import { unnecessaryEffectGen } from "./diagnostics/unnecessaryEffectGen.js"
import { unnecessaryPipe } from "./diagnostics/unnecessaryPipe.js"
import { unnecessaryPipeChain } from "./diagnostics/unnecessaryPipeChain.js"

export const diagnostics = [
  classSelfMismatch,
  duplicatePackage,
  missingEffectContext,
  missingEffectError,
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
  outdatedEffectCodegen
]
