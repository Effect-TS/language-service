import { pipe } from "effect/Function"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const debugPerformance = LSP.createRefactor({
  name: "debugPerformance",
  description: "Debug: LSP Performance",
  apply: Nano.fn("debugPerformance.apply")(function*(sourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    return ({
      kind: "refactor.rewrite.effect.debugPerformance",
      description: "Debug: LSP Performance",
      apply: pipe(
        Nano.gen(function*() {
          const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

          changeTracker.insertText(
            sourceFile,
            0,
            "/** \n" + Nano.getTimings().join("\n") + "\n */"
          )
        }),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts)
      )
    })
  })
})
