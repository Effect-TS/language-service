import { pipe } from "effect"
import type * as ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as writeTagClassAccessors from "../refactors/writeTagClassAccessors.js"

export const unsupportedServiceAccessors = LSP.createDiagnostic({
  name: "unsupportedServiceAccessors",
  code: 21,
  severity: "warning",
  apply: Nano.fn("unsupportedServiceAccessors.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }

    ts.forEachChild(sourceFile, appendNodeToVisit)
    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      ts.forEachChild(node, appendNodeToVisit)

      // Check if this is a class declaration that might use unsupported service accessors
      if (ts.isClassDeclaration(node)) {
        const parseResult = yield* pipe(
          writeTagClassAccessors.parse(node),
          Nano.orElse(() => Nano.succeed(null))
        )

        if (parseResult && parseResult.involvedMembers.length > 0) {
          // Get existing static members in the class
          const existingStaticMembers = new Set<string>()
          node.members?.forEach((member) => {
            if (
              ts.isPropertyDeclaration(member) &&
              member.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword)
            ) {
              if (member.name && ts.isIdentifier(member.name)) {
                existingStaticMembers.add(ts.idText(member.name))
              }
            }
          })

          // Filter out members that already have static implementations
          const missingMembers = parseResult.involvedMembers.filter(({ property }) =>
            !existingStaticMembers.has(ts.symbolName(property))
          )

          if (missingMembers.length > 0) {
            const memberNames = missingMembers.map(({ property }) => `'${ts.symbolName(property)}'`).join(", ")

            report({
              location: parseResult.className,
              messageText:
                `Even if accessors are enabled, accessors for ${memberNames} won't be available because the signature have generic type parameters or multiple call signatures.`,
              fixes: [{
                fixName: "unsupportedServiceAccessors_enableCodegen",
                description: "Enable accessors codegen",
                apply: Nano.gen(function*() {
                  const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

                  // Add @effect-codegens comment before the class
                  const comment = "// @effect-codegens accessors\n"
                  changeTracker.insertText(sourceFile, ts.getTokenPosOfNode(node, sourceFile), comment)
                })
              }]
            })
          }
        }
      }
    }
  })
})
