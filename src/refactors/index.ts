import addPipe from "@effect/language-service/refactors/addPipe"
import asyncAwaitToGen from "@effect/language-service/refactors/asyncAwaitToGen"
import asyncAwaitToGenTryPromise from "@effect/language-service/refactors/asyncAwaitToGenTryPromise"
import functionToArrow from "@effect/language-service/refactors/functionToArrow"
import removePipe from "@effect/language-service/refactors/removePipe"
import toggleReturnTypeAnnotation from "@effect/language-service/refactors/toggleReturnTypeAnnotation"
import toggleTypeAnnotation from "@effect/language-service/refactors/toggleTypeAnnotation"
import wrapWithPipe from "@effect/language-service/refactors/wrapWithPipe"

export default {
  asyncAwaitToGen,
  asyncAwaitToGenTryPromise,
  removePipe,
  addPipe,
  functionToArrow,
  toggleTypeAnnotation,
  toggleReturnTypeAnnotation,
  wrapWithPipe
}
