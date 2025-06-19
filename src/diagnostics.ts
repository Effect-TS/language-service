import { duplicatePackage } from "./diagnostics/duplicatePackage.js"
import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { genericEffectServices } from "./diagnostics/genericEffectServices.js"
import { leakingRequirements } from "./diagnostics/leakingRequirements.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingReturnYieldStar } from "./diagnostics/missingReturnYieldStar.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { returnEffectInGen } from "./diagnostics/returnEffectInGen.js"
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
  returnEffectInGen
]
