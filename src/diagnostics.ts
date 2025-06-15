import { duplicatePackage } from "./diagnostics/duplicatePackage.js"
import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { leakingRequirements } from "./diagnostics/leakingRequirements.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingReturnYieldStar } from "./diagnostics/missingReturnYieldStar.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { unnecessaryEffectGen } from "./diagnostics/unnecessaryEffectGen.js"

export const diagnostics = [
  duplicatePackage,
  missingEffectContext,
  missingEffectError,
  floatingEffect,
  missingStarInYieldEffectGen,
  unnecessaryEffectGen,
  missingReturnYieldStar,
  leakingRequirements
]
