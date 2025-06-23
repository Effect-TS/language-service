import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import { hasProperty, isFunction } from "effect/Predicate"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const importFromBarrel = LSP.createDiagnostic({
  name: "importFromBarrel",
  code: 12,
  severity: "error",
  apply: Nano.fn("importFromBarrel.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)

    if (!(hasProperty(typeChecker, "resolveExternalModuleName") && isFunction(typeChecker.resolveExternalModuleName))) {
      return
    }
    const _internalResolveExternalModuleName: (moduleSpecifier: ts.Expression) => ts.Symbol | undefined =
      typeChecker.resolveExternalModuleName

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!

      if (
        ts.isImportDeclaration(node) && node.importClause && node.importClause.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        const moduleSymbol = _internalResolveExternalModuleName(node.moduleSpecifier)
        if (moduleSymbol && moduleSymbol.exports) {
          for (const element of node.importClause.namedBindings.elements) {
            const nodeForSymbol = element.propertyName || element.name
            // we can only check for identifiers
            if (!ts.isIdentifier(nodeForSymbol)) continue
            const importedName = nodeForSymbol.text
            // get the symbol of the re-export
            const reexportedSymbol = moduleSymbol.exports.get(ts.escapeLeadingUnderscores(importedName))
            if (!reexportedSymbol) continue
            // if we have only a declaration
            if (reexportedSymbol.declarations && reexportedSymbol.declarations.length === 1) {
              // that should be an 'export * as X from "module"'
              const namespaceExport = reexportedSymbol.declarations[0]
              if (!ts.isNamespaceExport(namespaceExport)) continue
              // parent should be an export declaration
              const exportDeclaration = namespaceExport.parent
              if (!ts.isExportDeclaration(exportDeclaration)) continue
              // if we have a module specifier, resolve that symbol
              if (!exportDeclaration.moduleSpecifier) continue
              const originalModuleSymbol = _internalResolveExternalModuleName(exportDeclaration.moduleSpecifier)
              if (!originalModuleSymbol) continue
              // the value declaration should be the sourcefile of the original module
              if (!originalModuleSymbol.valueDeclaration) continue
              console.log(originalModuleSymbol)
            }
          }
        }
      }
    }
  })
})
