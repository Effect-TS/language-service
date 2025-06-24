import type ts from "typescript"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

export const importFromBarrel = LSP.createDiagnostic({
  name: "importFromBarrel",
  code: 12,
  severity: "off",
  apply: Nano.fn("importFromBarrel.apply")(function*(sourceFile, report) {
    // requires namespaceImportPackages to be set
    const languageServicePluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)
    if (languageServicePluginOptions.namespaceImportPackages.length === 0) return

    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)

    const isImportedFromBarrelExport = (
      element: ts.ImportSpecifier,
      languageServicePluginOptions: LanguageServicePluginOptions.LanguageServicePluginOptions
    ) => {
      const getModuleSpecifier = TypeScriptApi.makeGetModuleSpecifier(ts)
      const resolveExternalModuleName = TypeCheckerApi.makeResolveExternalModuleName(typeChecker)

      if (!(getModuleSpecifier && resolveExternalModuleName)) return

      const importDeclaration = ts.findAncestor(element, (node) => ts.isImportDeclaration(node))
      if (!importDeclaration) return
      if (!ts.isStringLiteral(importDeclaration.moduleSpecifier)) return
      const importClause = importDeclaration.importClause
      if (!importClause) return
      const namedBindings = importClause.namedBindings
      if (!namedBindings) return
      if (!ts.isNamedImports(namedBindings)) return

      const barrelModuleName = importDeclaration.moduleSpecifier.text
      if (languageServicePluginOptions.namespaceImportPackages.indexOf(barrelModuleName.toLowerCase()) === -1) return
      const moduleSymbol = resolveExternalModuleName(importDeclaration.moduleSpecifier)
      if (!moduleSymbol) return
      if (!moduleSymbol.exports) return
      const sourceFile = importDeclaration.getSourceFile()

      const nodeForSymbol = element.propertyName || element.name

      // we can only check for identifiers
      if (!ts.isIdentifier(nodeForSymbol)) return
      const importedName = nodeForSymbol.text
      // get the symbol of the re-export
      const reexportedSymbol = moduleSymbol.exports.get(ts.escapeLeadingUnderscores(importedName))
      if (!reexportedSymbol) return
      // if we have only a declaration
      if (!(reexportedSymbol.declarations && reexportedSymbol.declarations.length === 1)) return
      // that should be an 'export * as X from "module"'
      const namespaceExport = reexportedSymbol.declarations[0]
      if (!ts.isNamespaceExport(namespaceExport)) return
      // parent should be an export declaration
      const exportDeclaration = namespaceExport.parent
      if (!ts.isExportDeclaration(exportDeclaration)) return
      // if we have a module specifier, resolve that symbol
      if (!exportDeclaration.moduleSpecifier) return
      const originalModuleSymbol = resolveExternalModuleName(exportDeclaration.moduleSpecifier)
      if (!originalModuleSymbol) return
      // the value declaration should be the sourcefile of the original module
      if (!originalModuleSymbol.valueDeclaration) return
      const originalSourceFile = originalModuleSymbol.valueDeclaration.getSourceFile()
      const unbarrelledFileName = getModuleSpecifier(
        program.getCompilerOptions(),
        sourceFile,
        sourceFile.fileName,
        originalSourceFile.fileName,
        program
      )
      // need to start with the barrel module name, otherwise its not the same package
      if (unbarrelledFileName.toLowerCase().indexOf(barrelModuleName.toLowerCase() + "/") === -1) return
      return { unbarrelledFileName, importedName, barrelModuleName, importClause, namedBindings, importDeclaration }
    }

    const nodeToVisit: Array<ts.Node> = []
    const appendNodeToVisit = (node: ts.Node) => {
      nodeToVisit.push(node)
      return undefined
    }
    ts.forEachChild(sourceFile, appendNodeToVisit)

    while (nodeToVisit.length > 0) {
      const node = nodeToVisit.shift()!
      const parent = node.parent

      if (!(ts.isImportSpecifier(node) && ts.isNamedImports(parent))) {
        ts.forEachChild(node, appendNodeToVisit)
        continue
      }

      const result = isImportedFromBarrelExport(node, languageServicePluginOptions)
      if (!result) continue
      const { barrelModuleName, importClause, importDeclaration, importedName, namedBindings, unbarrelledFileName } =
        result
      // ok, I think now we can report the error
      report({
        node,
        messageText: `Importing from barrel module ${barrelModuleName} is not allowed.`,
        fixes: [
          {
            fixName: "replaceWithUnbarrelledImport",
            description: `Import * as ${importedName} from ${unbarrelledFileName}`,
            apply: Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)

              const newImport = ts.factory.createImportDeclaration(
                undefined,
                ts.factory.createImportClause(
                  importClause.isTypeOnly || node.isTypeOnly,
                  undefined,
                  ts.factory.createNamespaceImport(ts.factory.createIdentifier(importedName))
                ),
                ts.factory.createStringLiteral(unbarrelledFileName)
              )

              if (namedBindings.elements.length === 1) {
                changeTracker.replaceNode(
                  sourceFile,
                  importDeclaration,
                  newImport
                )
              } else {
                changeTracker.insertNodeAfter(sourceFile, importDeclaration, newImport)
                changeTracker.replaceNode(
                  sourceFile,
                  namedBindings,
                  ts.factory.updateNamedImports(
                    namedBindings,
                    namedBindings.elements.filter((e) => e !== node)
                  )
                )
              }
            })
          }
        ]
      })
    }
  })
})
