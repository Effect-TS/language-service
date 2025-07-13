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
import { returnEffectInGen } from "./diagnostics/returnEffectInGen.js"
import { scopeInLayerEffect } from "./diagnostics/scopeInLayerEffect.js"
import { tryCatchInEffectGen } from "./diagnostics/tryCatchInEffectGen.js"
import { unnecessaryEffectGen } from "./diagnostics/unnecessaryEffectGen.js"
import { unnecessaryPipe } from "./diagnostics/unnecessaryPipe.js"

export const diagnostics = [
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
  effectInVoidSuccess
]
