import asyncAwaitToGen from "@effect/language-service/refactors/asyncAwaitToGen"
import asyncAwaitToGenTryPromise from "@effect/language-service/refactors/asyncAwaitToGenTryPromise"
import functionToArrow from "@effect/language-service/refactors/functionToArrow"
import pipeableToDatafirst from "@effect/language-service/refactors/pipeableToDatafirst"
import toggleLazyConst from "@effect/language-service/refactors/toggleLazyConst"
import toggleReturnTypeAnnotation from "@effect/language-service/refactors/toggleReturnTypeAnnotation"
import toggleTypeAnnotation from "@effect/language-service/refactors/toggleTypeAnnotation"
import wrapWithPipe from "@effect/language-service/refactors/wrapWithPipe"

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
