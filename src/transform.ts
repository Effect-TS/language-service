import * as Array from "effect/Array"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import type { PluginConfig, TransformerExtras } from "ts-patch"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "./core/LanguageServicePluginOptions"
import * as LSP from "./core/LSP"
import * as Nano from "./core/Nano"
import * as TypeCheckerApi from "./core/TypeCheckerApi"
import * as TypeParser from "./core/TypeParser"
import * as TypeScriptApi from "./core/TypeScriptApi"
import * as TypeScriptUtils from "./core/TypeScriptUtils"
import { diagnostics } from "./diagnostics"

const programsChecked = new WeakMap<ts.Program, Set<string>>()

export default function(
  program: ts.Program,
  pluginConfig: PluginConfig,
  { addDiagnostic, ts: tsInstance }: TransformerExtras
) {
  function runDiagnostics(program: ts.Program, sourceFile: ts.SourceFile) {
    // avoid to double-process the same file
    const checkedFiles = programsChecked.get(program) ?? new Set<string>()
    programsChecked.set(program, checkedFiles)
    if (checkedFiles.has(sourceFile.fileName)) return
    checkedFiles.add(sourceFile.fileName)

    // run the diagnostics and pipe them into addDiagnostic
    pipe(
      LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, sourceFile),
      TypeParser.nanoLayer,
      TypeScriptUtils.nanoLayer,
      Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
      Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
      Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
      Nano.provideService(
        LanguageServicePluginOptions.LanguageServicePluginOptions,
        LanguageServicePluginOptions.parse(pluginConfig)
      ),
      Nano.run,
      Either.map((_) => _.diagnostics),
      Either.map(
        Array.filter((_) =>
          _.category === tsInstance.DiagnosticCategory.Error ||
          _.category === tsInstance.DiagnosticCategory.Warning
        )
      ),
      Either.getOrElse(() => []),
      Array.map(addDiagnostic)
    )
  }

  // process root files (works for noEmit: true)
  const rootFileNames = program.getRootFileNames()
  const sourceFiles = program.getSourceFiles().filter((_) => rootFileNames.indexOf(_.fileName) > -1)
  for (const sourceFile of sourceFiles) {
    runDiagnostics(program, sourceFile)
  }

  return (_: ts.TransformationContext) => (sourceFile: ts.SourceFile) => {
    // just be sure to try process any way (for noEmit: false with non catched files)
    runDiagnostics(program, sourceFile)
    return sourceFile
  }
}
