// @effect-diagnostics effectFnImplicitAny:error
import * as Effect from "effect/Effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"

export const Route = HttpRouter.use(
    Effect.fnUntraced(function*(router){
        yield* router.add(
            "GET",
            "/",
            Effect.fnUntraced(function*(request){
                return HttpServerResponse.empty()
            })
        )
    })
)
