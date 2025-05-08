import { asyncAwaitToGen } from "./refactors/asyncAwaitToGen.js"
import { asyncAwaitToGenTryPromise } from "./refactors/asyncAwaitToGenTryPromise.js"
import { effectGenToFn } from "./refactors/effectGenToFn.js"
import { functionToArrow } from "./refactors/functionToArrow.js"
import { pipeableToDatafirst } from "./refactors/pipeableToDatafirst.js"
import { removeUnnecessaryEffectGen } from "./refactors/removeUnnecessaryEffectGen.js"
import { toggleLazyConst } from "./refactors/toggleLazyConst.js"
import { toggleReturnTypeAnnotation } from "./refactors/toggleReturnTypeAnnotation.js"
import { toggleTypeAnnotation } from "./refactors/toggleTypeAnnotation.js"
import { wrapWithEffectGen } from "./refactors/wrapWithEffectGen.js"
import { wrapWithPipe } from "./refactors/wrapWithPipe.js"

export const refactors = [
  asyncAwaitToGen,
  asyncAwaitToGenTryPromise,
  functionToArrow,
  pipeableToDatafirst,
  removeUnnecessaryEffectGen,
  toggleLazyConst,
  toggleReturnTypeAnnotation,
  toggleTypeAnnotation,
  wrapWithEffectGen,
  wrapWithPipe,
  effectGenToFn
]
