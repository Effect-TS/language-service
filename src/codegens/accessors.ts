import { pipe } from "effect/Function"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"
import * as refactor from "../refactors/writeTagClassAccessors.js"

export const accessors = LSP.createCodegen({
  name: "accessors",
  apply: Nano.fn("accessors.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const nodeAndCommentRange = tsUtils.findNodeWithLeadingCommentAtPosition(sourceFile, textRange.pos)
    if (!nodeAndCommentRange) return yield* Nano.fail(new LSP.CodegenNotApplicableError("no node and comment range"))

    return yield* pipe(
      refactor.parse(nodeAndCommentRange.node),
      Nano.map((_) =>
        ({
          hash: _.hash,
          description: "Generate accessors for the service",
          apply: pipe(
            refactor.generate(sourceFile, _.Service, _.className, _.atLocation, _.involvedMembers),
            Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
            Nano.provideService(TypeScriptUtils.TypeScriptUtils, tsUtils),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
            Nano.provideService(TypeParser.TypeParser, typeParser)
          )
        }) satisfies LSP.ApplicableCodegenDefinition
      ),
      Nano.orElse((cause) => Nano.fail(new LSP.CodegenNotApplicableError(cause)))
    )
  })
})
