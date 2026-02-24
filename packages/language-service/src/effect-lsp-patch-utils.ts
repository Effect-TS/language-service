import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"
import type * as ts from "typescript"
import * as LanguageServicePluginOptions from "./core/LanguageServicePluginOptions"
import * as LSP from "./core/LSP"
import * as Nano from "./core/Nano"
import * as TypeCheckerApi from "./core/TypeCheckerApi"
import * as TypeCheckerUtils from "./core/TypeCheckerUtils"
import * as TypeParser from "./core/TypeParser"
import * as TypeScriptApi from "./core/TypeScriptApi"
import * as TypeScriptUtils from "./core/TypeScriptUtils"
import { diagnostics } from "./diagnostics"

const extractEffectLspOptions = (compilerOptions: ts.CompilerOptions) => {
  return (Predicate.hasProperty(compilerOptions, "plugins") && Array.isArray(compilerOptions.plugins)
    ? compilerOptions.plugins
    : []).find((_) => Predicate.hasProperty(_, "name") && _.name === "@effect/language-service")
}

export function clearSourceFileEffectMetadata(
  sourceFile: ts.SourceFile
) {
  LSP.getOrDefaultEffectLspPatchSourceFileMetadata(sourceFile).relationErrors = []
}

export function appendMetadataRelationError(
  tsInstance: TypeScriptApi.TypeScriptApi,
  errorNode: ts.Node,
  source: ts.Type,
  target: ts.Type
) {
  let sourceFile = errorNode
  while (sourceFile.parent && !tsInstance.isSourceFile(sourceFile)) {
    sourceFile = sourceFile.parent
  }
  if (tsInstance.isSourceFile(sourceFile)) {
    LSP.getOrDefaultEffectLspPatchSourceFileMetadata(sourceFile).relationErrors.push([
      errorNode,
      target,
      errorNode,
      source
    ])
  }
}

export function checkSourceFileWorker(
  tsInstance: TypeScriptApi.TypeScriptApi,
  program: ts.Program,
  sourceFile: ts.SourceFile,
  compilerOptions: ts.CompilerOptions,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void,
  moduleName: string
) {
  // check if the plugin is enabled
  const pluginOptions = extractEffectLspOptions(compilerOptions)
  if (!pluginOptions) return

  const parsedOptions: LanguageServicePluginOptions.LanguageServicePluginOptions = {
    ...LanguageServicePluginOptions.parse(pluginOptions),
    diagnosticsName: true
  }

  // run the diagnostics and pipe them into addDiagnostic
  pipe(
    LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, sourceFile),
    TypeParser.nanoLayer,
    TypeCheckerUtils.nanoLayer,
    TypeScriptUtils.nanoLayer,
    Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
    Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
    Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
    Nano.provideService(
      LanguageServicePluginOptions.LanguageServicePluginOptions,
      parsedOptions
    ),
    Nano.unsafeRun,
    Result.map((_) => _.diagnostics),
    Result.map(
      Array.filter((_) =>
        _.category === tsInstance.DiagnosticCategory.Error ||
        _.category === tsInstance.DiagnosticCategory.Warning ||
        (moduleName === "tsc" && parsedOptions.includeSuggestionsInTsc && (
          _.category === tsInstance.DiagnosticCategory.Message ||
          _.category === tsInstance.DiagnosticCategory.Suggestion
        ))
      )
    ),
    Result.map(
      Array.map((_) => {
        if (
          moduleName === "tsc" && parsedOptions.includeSuggestionsInTsc &&
          _.category === tsInstance.DiagnosticCategory.Suggestion
        ) {
          return { ..._, category: tsInstance.DiagnosticCategory.Message }
        }
        return _
      })
    ),
    Result.getOrElse((e) => {
      console.error(e.message, "at", e.lastSpan)
      return []
    }),
    Array.map(addDiagnostic)
  )
}

export function extractDiagnosticsForExitStatus(
  tsInstance: TypeScriptApi.TypeScriptApi,
  program: ts.Program,
  diagnostics: Array<ts.Diagnostic>,
  _moduleName: string
) {
  const options = extractEffectLspOptions(program.getCompilerOptions())
  const parsedOptions = LanguageServicePluginOptions.parse(options)

  let newDiagnostics = diagnostics

  // if the option is enabled, exclude suggestions
  if (parsedOptions.ignoreEffectSuggestionsInTscExitCode) {
    newDiagnostics = Array.filter(
      newDiagnostics,
      (_) => !(_.source === "effect" && _.category === tsInstance.DiagnosticCategory.Message)
    )
  }

  // if the option is enabled, exclude warnings
  if (parsedOptions.ignoreEffectWarningsInTscExitCode) {
    newDiagnostics = Array.filter(
      newDiagnostics,
      (_) => !(_.source === "effect" && _.category === tsInstance.DiagnosticCategory.Warning)
    )
  }

  return newDiagnostics
}
