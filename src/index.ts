import { Either } from "effect"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "./core/LSP.js"
import * as Nano from "./core/Nano.js"
import { diagnostics } from "./diagnostics.js"
import { dedupeJsDocTags, prependEffectTypeArguments } from "./quickinfo.js"
import { refactors } from "./refactors.js"
import * as TypeCheckerApi from "./utils/TypeCheckerApi.js"
import * as TypeScriptApi from "./utils/TypeScriptApi.js"

const init = (
  modules: {
    typescript: typeof ts
  }
) => {
  function create(info: ts.server.PluginCreateInfo) {
    const languageService = info.languageService
    const pluginOptions: LSP.PluginOptions = {
      diagnostics:
        info.config && "diagnostics" in info.config && typeof info.config.diagnostics === "boolean"
          ? info.config.diagnostics
          : true,
      quickinfo:
        info.config && "quickinfo" in info.config && typeof info.config.quickinfo === "boolean"
          ? info.config.quickinfo
          : true
    }

    // create the proxy
    const proxy: ts.LanguageService = Object.create(null)
    for (const k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
      // @ts-expect-error
      proxy[k] = (...args: Array<{}>) => languageService[k]!.apply(languageService, args)
    }

    proxy.getSemanticDiagnostics = (fileName, ...args) => {
      const applicableDiagnostics = languageService.getSemanticDiagnostics(fileName, ...args)
      const program = languageService.getProgram()

      if (pluginOptions.diagnostics && program) {
        const sourceFile = program.getSourceFile(fileName)

        if (sourceFile) {
          return pipe(
            LSP.getSemanticDiagnostics(Object.values(diagnostics), sourceFile),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(LSP.PluginOptions, pluginOptions),
            Nano.run,
            Either.map((effectDiagnostics) => effectDiagnostics.concat(applicableDiagnostics)),
            Either.getOrElse(() => applicableDiagnostics)
          )
        }
      }

      return applicableDiagnostics
    }

    proxy.getApplicableRefactors = (...args) => {
      const applicableRefactors = languageService.getApplicableRefactors(...args)
      const [fileName, positionOrRange] = args
      const program = languageService.getProgram()

      if (program) {
        const sourceFile = program.getSourceFile(fileName)
        if (sourceFile) {
          return pipe(
            LSP.getApplicableRefactors(Object.values(refactors), sourceFile, positionOrRange),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(LSP.PluginOptions, pluginOptions),
            Nano.run,
            Either.map((effectRefactors) => applicableRefactors.concat(effectRefactors)),
            Either.getOrElse(() => applicableRefactors)
          )
        }
      }
      return applicableRefactors
    }

    proxy.getEditsForRefactor = (
      fileName,
      formatOptions,
      positionOrRange,
      refactorName,
      actionName,
      preferences,
      ...args
    ) => {
      const program = languageService.getProgram()
      if (program) {
        const sourceFile = program.getSourceFile(fileName)
        if (sourceFile) {
          const result = pipe(
            Nano.gen(function*() {
              const applicableRefactor = yield* LSP.getEditsForRefactor(
                Object.values(refactors),
                sourceFile,
                positionOrRange,
                refactorName
              )

              const formatContext = modules.typescript.formatting.getFormatContext(
                formatOptions,
                info.languageServiceHost
              )
              const edits = modules.typescript.textChanges.ChangeTracker.with(
                {
                  formatContext,
                  host: info.languageServiceHost,
                  preferences: preferences || {}
                },
                (changeTracker) =>
                  pipe(
                    applicableRefactor.apply,
                    Nano.provideService(TypeScriptApi.ChangeTracker, changeTracker),
                    Nano.run
                  )
              )

              return { edits } as ts.RefactorEditInfo
            }),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(LSP.PluginOptions, pluginOptions),
            Nano.run
          )

          if (Either.isRight(result)) return result.right
        }
      }

      return languageService.getEditsForRefactor(
        fileName,
        formatOptions,
        positionOrRange,
        refactorName,
        actionName,
        preferences,
        ...args
      )
    }

    proxy.getQuickInfoAtPosition = (fileName, position, ...args) => {
      const quickInfo = languageService.getQuickInfoAtPosition(fileName, position, ...args)

      if (pluginOptions.quickinfo && quickInfo) {
        const dedupedTagsQuickInfo = dedupeJsDocTags(quickInfo)

        const program = languageService.getProgram()
        if (program) {
          const sourceFile = program.getSourceFile(fileName)
          if (sourceFile) {
            return pipe(
              prependEffectTypeArguments(
                sourceFile,
                position,
                dedupedTagsQuickInfo
              ),
              Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
              Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
              Nano.run,
              Either.getOrElse(() => dedupedTagsQuickInfo)
            )
          }
        }

        return dedupedTagsQuickInfo
      }

      return quickInfo
    }

    return proxy
  }

  return { create }
}

module.exports = init
