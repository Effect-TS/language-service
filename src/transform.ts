import * as Array from "effect/Array"
import * as Either from "effect/Either"
import { pipe } from "effect/Function"
import type { PluginConfig, TransformerExtras } from "ts-patch"
import type * as ts from "typescript"
import * as LSP from "../src/core/LSP"
import * as Nano from "../src/core/Nano"
import * as TypeCheckerApi from "../src/core/TypeCheckerApi"
import * as TypeScriptApi from "../src/core/TypeScriptApi"
import { diagnostics } from "../src/diagnostics"

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
        Nano.provideService(
          TypeCheckerApi.TypeCheckerApiCache,
          TypeCheckerApi.makeTypeCheckerApiCache()
        ),
        Nano.provideService(LSP.PluginOptions, LSP.parsePluginOptions(pluginConfig)),
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
