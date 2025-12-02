import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"

export const annotate = LSP.createCodegen({
  name: "annotate",
  apply: Nano.fn("annotate.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)

    const parse = (node: ts.Node) =>
      Nano.gen(function*() {
        let variableDeclarations: Array<ts.VariableDeclaration> = []
        const result: Array<
          { variableDeclaration: ts.VariableDeclaration; initializerTypeNode: ts.TypeNode; hash: string }
        > = []

        if (ts.isVariableStatement(node)) {
          variableDeclarations = [...variableDeclarations, ...node.declarationList.declarations]
        } else if (ts.isVariableDeclarationList(node)) {
          variableDeclarations = [...variableDeclarations, ...node.declarations]
        } else if (ts.isVariableDeclaration(node)) {
          variableDeclarations = [...variableDeclarations, node]
        }

        if (variableDeclarations.length === 0) {
          return yield* Nano.fail(new LSP.CodegenNotApplicableError("not a variable declaration"))
        }

        for (const variableDeclaration of variableDeclarations) {
          if (!variableDeclaration.initializer) continue
          const initializerType = typeChecker.getTypeAtLocation(variableDeclaration.initializer)
          const enclosingNode = ts.findAncestor(variableDeclaration, (_) => tsUtils.isDeclarationKind(_.kind)) ||
            sourceFile
          const initializerTypeNode = Option.fromNullable(typeCheckerUtils.typeToSimplifiedTypeNode(
            initializerType,
            enclosingNode,
            ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.IgnoreErrors
          )).pipe(
            Option.getOrUndefined
          )
          if (!initializerTypeNode) continue
          const typeNodeString = typeChecker.typeToString(initializerType, undefined, ts.TypeFormatFlags.NoTruncation)
          const hash = LSP.cyrb53(typeNodeString)

          result.push({ variableDeclaration, initializerTypeNode, hash })
        }
        if (result.length === 0) {
          return yield* Nano.fail(new LSP.CodegenNotApplicableError("no variable declarations with initializers"))
        }
        const hash = LSP.cyrb53(result.map((_) => _.hash).join("/"))

        return ({
          hash,
          result
        })
      })

    const nodeAndCommentRange = tsUtils.findNodeWithLeadingCommentAtPosition(sourceFile, textRange.pos)
    if (!nodeAndCommentRange) return yield* Nano.fail(new LSP.CodegenNotApplicableError("no node and comment range"))

    return yield* pipe(
      parse(nodeAndCommentRange.node),
      Nano.map((_) =>
        ({
          hash: _.hash,
          description: "Annotate with type",
          apply: Nano.gen(function*() {
            const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
            for (const { initializerTypeNode, variableDeclaration } of _.result) {
              if (variableDeclaration.type) {
                changeTracker.deleteRange(sourceFile, {
                  pos: variableDeclaration.name.end,
                  end: variableDeclaration.type.end
                })
              }
              changeTracker.insertNodeAt(
                sourceFile,
                variableDeclaration.name.end,
                initializerTypeNode,
                {
                  prefix: ": "
                }
              )
            }
          })
        }) satisfies LSP.ApplicableCodegenDefinition
      )
    )
  })
})
