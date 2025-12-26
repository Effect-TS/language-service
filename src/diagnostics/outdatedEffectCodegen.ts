import { pipe } from "effect/Function"
import { codegens } from "../codegens.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"

export const outdatedEffectCodegen = LSP.createDiagnostic({
  name: "outdatedEffectCodegen",
  code: 19,
  description: "Detects when generated code is outdated and needs to be regenerated",
  severity: "warning",
  apply: Nano.fn("outdatedEffectCodegen.apply")(function*(sourceFile, _report) {
    const codegensWithRanges = yield* LSP.getCodegensForSourceFile(codegens, sourceFile)
    for (const { codegen, hash, range } of codegensWithRanges) {
      yield* pipe(
        LSP.getEditsForCodegen([codegen], sourceFile, range),
        Nano.map((applicable) => {
          if (applicable.hash !== hash) {
            _report({
              location: range,
              messageText: `Codegen ${codegen.name} result is outdated`,
              fixes: [
                {
                  fixName: "outdatedEffectCodegen_fix",
                  description: `Re-run ${codegen.name}`,
                  apply: applicable.apply
                },
                {
                  fixName: "outdatedEffectCodegen_ignore",
                  description: `Ignore this ${codegen.name} update`,
                  apply: applicable.ignore
                }
              ]
            })
          }
        }),
        Nano.orElse((e) =>
          Nano.sync(() => {
            _report({
              location: range,
              messageText: `Codegen ${codegen.name} is not applicable here: ${e.cause}`,
              fixes: []
            })
          })
        ),
        Nano.ignore
      )
    }
  })
})
