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
import { diagnostics } from "./diagnostics"

export default function(
  program: ts.Program,
  pluginConfig: PluginConfig,
  { addDiagnostic, ts: tsInstance }: TransformerExtras
) {
  return (_: ts.TransformationContext) => {
    return (sourceFile: ts.SourceFile) => {
      // run the diagnostics and pipe them into addDiagnostic
      pipe(
        LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, sourceFile),
        Nano.provideService(TypeScriptApi.TypeScriptApi, tsInstance),
        Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
        Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
        Nano.provideService(TypeParser.TypeParser, TypeParser.make(tsInstance, program.getTypeChecker())),
        Nano.provideService(
          TypeCheckerApi.TypeCheckerApiCache,
          TypeCheckerApi.makeTypeCheckerApiCache()
        ),
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

      // do not transform source ccde
      return sourceFile
    }
  }
}
