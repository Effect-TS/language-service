import addPipe from "@effect/language-service/refactors/addPipe"
import asyncAwaitToGen from "@effect/language-service/refactors/asyncAwaitToGen"
import asyncAwaitToGenTryPromise from "@effect/language-service/refactors/asyncAwaitToGenTryPromise"
import functionToArrow from "@effect/language-service/refactors/functionToArrow"
import removeCurryArrow from "@effect/language-service/refactors/removeCurryArrow"
import removePipe from "@effect/language-service/refactors/removePipe"

export default { asyncAwaitToGen, asyncAwaitToGenTryPromise, removePipe, addPipe, removeCurryArrow, functionToArrow }
