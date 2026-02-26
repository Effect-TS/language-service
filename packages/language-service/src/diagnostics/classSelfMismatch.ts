import { pipe } from "effect"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const classSelfMismatch = LSP.createDiagnostic({
  name: "classSelfMismatch",
  code: 20,
  description: "Ensures Self type parameter matches the class name in Service/Tag/Schema classes",
  severity: "error",
  apply: Nano.fn("classSelfMismatch.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      // Check if this is a class declaration that extends Effect.Service, Context.Tag, or Schema classes
      if (ts.isClassDeclaration(node) && node.name && node.heritageClauses) {
        // Check if this class extends a class that has a Self type parameter
        const result = yield* pipe(
          typeParser.extendsEffectService(node),
          Nano.orElse(() => typeParser.extendsContextTag(node)),
          Nano.orElse(() => typeParser.extendsEffectTag(node)),
          Nano.orElse(() => typeParser.extendsSchemaClass(node)),
          Nano.orElse(() => typeParser.extendsSchemaTaggedClass(node)),
          Nano.orElse(() => typeParser.extendsSchemaTaggedError(node)),
          Nano.orElse(() =>
            pipe(
              typeParser.extendsSchemaTaggedRequest(node),
              Nano.orElse(() => typeParser.extendsSchemaRequestClass(node))
            )
          ),
          Nano.orElse(() => typeParser.extendsEffectSqlModelClass(node)),
          Nano.orElse(() => typeParser.extendsEffectSchemaModelClass(node)),
          Nano.orElse(() => Nano.void_)
        )

        if (result) {
          // Both methods return { selfTypeNode, className } when they match
          const { className, selfTypeNode } = result

          // Get the actual name from the self type node
          let actualName = sourceFile.text.substring(selfTypeNode.pos, selfTypeNode.end)
          if (ts.isTypeReferenceNode(selfTypeNode)) {
            if (ts.isIdentifier(selfTypeNode.typeName)) {
              actualName = ts.idText(selfTypeNode.typeName)
            } else if (ts.isQualifiedName(selfTypeNode.typeName)) {
              actualName = ts.idText(selfTypeNode.typeName.right)
            }
          }

          // Check if the self type matches the class name
          const expectedName = ts.idText(className)
          if (actualName !== expectedName) {
            report({
              location: selfTypeNode,
              messageText: `Self type parameter should be '${expectedName}'`,
              fixes: [{
                fixName: "classSelfMismatch_fix",
                description: `Replace '${actualName}' with '${expectedName}'`,
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  // Create a new type reference with the correct class name
                  const typeArgs = ts.isTypeReferenceNode(selfTypeNode) ? selfTypeNode.typeArguments : undefined
                  const newTypeReference = ts.factory.createTypeReferenceNode(
                    ts.factory.createIdentifier(expectedName),
                    typeArgs
                  )

                  // Replace the incorrect type reference with the correct one
                  changeTracker.replaceNode(sourceFile, selfTypeNode, newTypeReference)
                })
              }]
            })
          }
        }
      }

      ts.forEachChild(node, appendNodeToVisit)
    }
  })
})
