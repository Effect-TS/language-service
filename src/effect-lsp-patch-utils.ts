import * as Array from "effect/Array"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
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

export function checkSourceFileWorker(
  tsInstance: TypeScriptApi.TypeScriptApi,
  program: ts.Program,
  sourceFile: ts.SourceFile,
  compilerOptions: ts.CompilerOptions,
  addDiagnostic: (diagnostic: ts.Diagnostic) => void
) {
  // check if the plugin is enabled
  const pluginOptions = pipe(
    (compilerOptions.plugins || []) as Array<any>,
    Array.findFirst((_) => Predicate.hasProperty(_, "name") && _.name === "@effect/language-service")
  )
  if (Option.isNone(pluginOptions)) {
    return
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
      LanguageServicePluginOptions.parse(pluginOptions)
    ),
    Nano.unsafeRun,
    Either.map((_) => _.diagnostics),
    Either.map(
      Array.filter((_) =>
        _.category === tsInstance.DiagnosticCategory.Error ||
        _.category === tsInstance.DiagnosticCategory.Warning
      )
    ),
    Either.getOrElse((e) => {
      console.error(e)
      return []
    }),
    Array.map(addDiagnostic)
  )
}
