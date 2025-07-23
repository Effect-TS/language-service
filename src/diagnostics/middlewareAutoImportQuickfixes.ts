import { pipe } from "effect/Function"
import type * as ts from "typescript"
import * as AutoImport from "../core/AutoImport"
import * as Nano from "../core/Nano"
import * as TypeScriptApi from "../core/TypeScriptApi"

export const middlewareAutoImportQuickfixes = Nano.fn("middlewareAutoImportQuickfixes")(function*(
  sourceFile: ts.SourceFile,
  languageServiceHost: ts.LanguageServiceHost,
  formatOptions: ts.FormatCodeSettings,
  preferences: ts.UserPreferences | undefined,
  codeFixes: ReadonlyArray<ts.CodeFixAction>
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)
  const autoImportProvider = yield* AutoImport.getOrMakeAutoImportProvider(sourceFile)
  const changedCodeFixes: Array<ts.CodeFixAction> = []

  const createImportAllChanges = (imports: Array<AutoImport.ParsedImportFromTextChange>) =>
    Nano.gen(function*() {
      const newImports: Array<AutoImport.ImportKind> = []
      for (const importToAdd of imports) {
        // we should have what to import
        if (!importToAdd.exportName) return
        // from the module name, get the file name
        const fileName = ts.resolveModuleName(
          importToAdd.moduleName,
          sourceFile.fileName,
          program.getCompilerOptions(),
          program as any
        )
        if (!fileName.resolvedModule) return
        // resolve the import kind
        const importKind = autoImportProvider.resolve(fileName.resolvedModule.resolvedFileName, importToAdd.exportName)
        if (!importKind) return
        // we cannot retroactively change the whole source code
        if (importKind.introducedPrefix) return
        newImports.push(importKind)
      }
      // then we need to produce the actual changes
      const formatContext = ts.formatting.getFormatContext(
        formatOptions,
        languageServiceHost
      )

      const edits = ts.textChanges.ChangeTracker.with(
        {
          formatContext,
          host: languageServiceHost,
          preferences: preferences || {}
        },
        (changeTracker) =>
          newImports.forEach((_) => AutoImport.addImport(ts, sourceFile, changeTracker, preferences, _))
      )
      return edits
    })

  for (const codeFix of codeFixes) {
    const textFileChanges = codeFix.changes
    // only one change
    if (textFileChanges.length !== 1) {
      changedCodeFixes.push(codeFix)
      continue
    }
    // on the current file
    if (textFileChanges[0].fileName !== sourceFile.fileName) {
      changedCodeFixes.push(codeFix)
      continue
    }
    // should be import only changes
    const parsedChanges = yield* AutoImport.parseImportOnlyChanges(sourceFile, textFileChanges[0].textChanges)
    if (!parsedChanges) {
      changedCodeFixes.push(codeFix)
      continue
    }
    // no deletions!
    if (parsedChanges.deletions.length !== 0) {
      changedCodeFixes.push(codeFix)
      continue
    }
    // ok process them
    const changes = yield* pipe(
      createImportAllChanges(parsedChanges.imports),
      Nano.orElse(() => Nano.succeed(codeFix.changes))
    )
    if (changes) {
      changedCodeFixes.push({ ...codeFix, changes })
    } else {
      changedCodeFixes.push(codeFix)
    }
  }

  return changedCodeFixes
})
