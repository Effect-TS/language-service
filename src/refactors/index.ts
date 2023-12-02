import asyncAwaitToGen from "./asyncAwaitToGen.js"
import asyncAwaitToGenTryPromise from "./asyncAwaitToGenTryPromise.js"
import functionToArrow from "./functionToArrow.js"
import pipeableToDatafirst from "./pipeableToDatafirst.js"
import toggleLazyConst from "./toggleLazyConst.js"
import toggleReturnTypeAnnotation from "./toggleReturnTypeAnnotation.js"
import toggleTypeAnnotation from "./toggleTypeAnnotation.js"
import wrapWithPipe from "./wrapWithPipe.js"

export default {
  asyncAwaitToGen,
  asyncAwaitToGenTryPromise,
  functionToArrow,
  toggleTypeAnnotation,
  toggleReturnTypeAnnotation,
  wrapWithPipe,
  pipeableToDatafirst,
  toggleLazyConst
}
