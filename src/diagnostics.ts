/**
 * @since 1.0.0
 */
import { floatingEffect } from "./diagnostics/floatingEffect.js"
import { missingEffectContext } from "./diagnostics/missingEffectContext.js"
import { missingEffectError } from "./diagnostics/missingEffectError.js"

/**
 * @since 1.0.0
 */
export const diagnostics = { missingEffectContext, missingEffectError, floatingEffect }
