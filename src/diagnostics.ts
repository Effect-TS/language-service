import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"
import { missingStarInYieldEffectGen } from "./diagnostics/missingStarInYieldEffectGen.js"
import { multipleEffectVersions } from "./diagnostics/multipleEffectVersions.js"
import { unnecessaryEffectGen } from "./diagnostics/unnecessaryEffectGen.js"

export const diagnostics = [
  multipleEffectVersions,
  missingEffectContext,
  missingEffectError,
  floatingEffect,
  missingStarInYieldEffectGen,
  unnecessaryEffectGen
]
