/**
 * @since 1.0.0
 */
import { asyncAwaitToGen } from "./refactors/asyncAwaitToGen.js"
import { asyncAwaitToGenTryPromise } from "./refactors/asyncAwaitToGenTryPromise.js"
import { effectGenToFn } from "./refactors/effectGenToFn.js"
import { functionToArrow } from "./refactors/functionToArrow.js"
import { pipeableToDatafirst } from "./refactors/pipeableToDatafirst.js"
import { toggleLazyConst } from "./refactors/toggleLazyConst.js"
import { toggleReturnTypeAnnotation } from "./refactors/toggleReturnTypeAnnotation.js"
import { toggleTypeAnnotation } from "./refactors/toggleTypeAnnotation.js"
import { wrapWithPipe } from "./refactors/wrapWithPipe.js"

/**
 * @since 1.0.0
 */
export const refactors = {
  asyncAwaitToGen,
  asyncAwaitToGenTryPromise,
  functionToArrow,
  pipeableToDatafirst,
  toggleLazyConst,
  toggleReturnTypeAnnotation,
  toggleTypeAnnotation,
  wrapWithPipe,
  effectGenToFn
}
