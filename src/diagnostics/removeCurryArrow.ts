import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { createDiagnostic } from "@effect/language-service/diagnostics/definition"
import { isCurryArrow } from "@effect/language-service/utils"
import { pipe } from "@fp-ts/data/Function"
import * as Ch from "@tsplus/stdlib/collections/Chunk"

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
