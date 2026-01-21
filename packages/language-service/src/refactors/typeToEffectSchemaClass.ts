import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"
import * as SchemaGen from "../utils/SchemaGen.js"

export const typeToEffectSchemaClass = LSP.createRefactor({
  name: "typeToEffectSchemaClass",
  description: "Refactor to Schema.Class",
  apply: Nano.fn("typeToEffectSchemaClass.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const maybeNode = yield* SchemaGen.findNodeToProcess(sourceFile, textRange)

    if (Option.isNone(maybeNode)) return yield* Nano.fail(new LSP.RefactorNotApplicableError())
    const node = maybeNode.value

    return ({
      kind: "refactor.rewrite.effect.typeToEffectSchemaClass",
      description: "Refactor to Schema.Class",
      apply: pipe(
        SchemaGen.applyAtNode(sourceFile, node, true),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
        Nano.provideService(TypeScriptUtils.TypeScriptUtils, tsUtils),
        Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
        Nano.provideService(TypeCheckerUtils.TypeCheckerUtils, typeCheckerUtils)
      )
    })
  })
})
