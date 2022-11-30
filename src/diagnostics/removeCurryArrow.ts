import * as T from "@effect/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"
import { isCurryArrow } from "@effect/language-service/utils"
import * as Ch from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"

export default createDiagnostic({
  code: 1001,
  category: "suggestion",
  apply: (sourceFile) =>
    T.gen(function*($) {
      const ts = yield* $(T.service(AST.TypeScriptApi))

      return pipe(
        AST.collectAll(ts)(sourceFile, isCurryArrow(ts)),
        Ch.map((node) => ({
          node,
          messageText: "This arrow function may be not needed."
        }))
      )
    })
})
