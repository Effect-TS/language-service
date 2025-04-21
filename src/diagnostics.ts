import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { unnecessaryEffectGen } from "./diagnostics/unnecessaryEffectGen.js"

export const diagnostics = {
  missingEffectContext,
  missingEffectError,
  floatingEffect,
  missingStarInYieldEffectGen,
  unnecessaryEffectGen
}
