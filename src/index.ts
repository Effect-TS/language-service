import { Either } from "effect"
import { pipe } from "effect/Function"
import type ts from "typescript"
import { completions } from "./completions.js"
import * as LSP from "./core/LSP.js"
import * as Nano from "./core/Nano.js"
import * as TypeCheckerApi from "./core/TypeCheckerApi.js"
import * as TypeScriptApi from "./core/TypeScriptApi.js"
import { diagnostics } from "./diagnostics.js"
import { dedupeJsDocTags, prependEffectTypeArguments } from "./quickinfo.js"
import { refactors } from "./refactors.js"

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
          : true,
      completions:
        info.config && "completions" in info.config && typeof info.config.completions === "boolean"
          ? info.config.completions
          : true
    }

    // this is nothing more than an hack. Seems like vscode and other editors do not
    // support new error codes in diagnostics. Because they somehow rely on looking into
    // typescript.codefixes object. SO ONLY OPTION here is to register fake codefix.
    // by hooking into the codefixes object and registering a fake codefix.

    const diagnosticsErrorCodes = diagnostics.map((diagnostic) => diagnostic.code)
    try {
      ;(modules.typescript as any).codefix.registerCodeFix({
        errorCodes: diagnosticsErrorCodes,
        getCodeActions: () => undefined
      })
      // eslint-disable-next-line no-empty
    } catch (_) {}

    // create the proxy
    const proxy: ts.LanguageService = Object.create(null)
    for (const k of Object.keys(languageService) as Array<keyof ts.LanguageService>) {
      // @ts-expect-error
      proxy[k] = (...args: Array<{}>) => languageService[k]!.apply(languageService, args)
    }

    const effectCodeFixesForFile = new Map<
      string,
      Array<LSP.ApplicableDiagnosticDefinitionFixWithPositionAndCode>
    >()
    proxy.getSemanticDiagnostics = (fileName, ...args) => {
      const applicableDiagnostics = languageService.getSemanticDiagnostics(fileName, ...args)
      const program = languageService.getProgram()

      if (pluginOptions.diagnostics && program) {
        effectCodeFixesForFile.delete(fileName)
        const sourceFile = program.getSourceFile(fileName)

        if (sourceFile) {
          return pipe(
            LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, sourceFile),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(
              TypeCheckerApi.TypeCheckerApiCache,
              TypeCheckerApi.makeTypeCheckerApiCache()
            ),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
            Nano.provideService(LSP.PluginOptions, pluginOptions),
            Nano.run,
            Either.map(({ codeFixes, diagnostics }) => {
              effectCodeFixesForFile.set(fileName, codeFixes)
              return diagnostics.concat(applicableDiagnostics)
            }),
            Either.getOrElse(() => applicableDiagnostics)
          )
        }
      }

      return applicableDiagnostics
    }

    proxy.getSupportedCodeFixes = (...args) =>
      languageService.getSupportedCodeFixes(...args).concat(
        diagnosticsErrorCodes.map((_) => "" + _)
      )

    proxy.getCodeFixesAtPosition = (
      fileName,
      start,
      end,
      errorCodes,
      formatOptions,
      preferences,
      ...args
    ) => {
      const applicableCodeFixes = languageService.getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences,
        ...args
      )

      return pipe(
        Nano.sync(() => {
          const effectCodeFixes: Array<ts.CodeFixAction> = []
          const applicableFixes = (effectCodeFixesForFile.get(fileName) || []).filter((_) =>
            _.start === start && _.end === end && errorCodes.indexOf(_.code) > -1
          )

          const formatContext = modules.typescript.formatting.getFormatContext(
            formatOptions,
            info.languageServiceHost
          )

          for (const applicableFix of applicableFixes) {
            const changes = modules.typescript.textChanges.ChangeTracker.with(
              {
                formatContext,
                host: info.languageServiceHost,
                preferences: preferences || {}
              },
              (changeTracker) =>
                pipe(
                  applicableFix.apply,
                  Nano.provideService(TypeScriptApi.ChangeTracker, changeTracker),
                  Nano.run
                )
            )
            effectCodeFixes.push({
              fixName: applicableFix.fixName,
              description: applicableFix.description,
              changes
            })
          }

          return effectCodeFixes
        }),
        Nano.run,
        Either.map((effectCodeFixes) => applicableCodeFixes.concat(effectCodeFixes)),
        Either.getOrElse(() => applicableCodeFixes)
      )
    }

    proxy.getApplicableRefactors = (...args) => {
      const applicableRefactors = languageService.getApplicableRefactors(...args)
      const [fileName, positionOrRange] = args
      const program = languageService.getProgram()

      if (program) {
        const sourceFile = program.getSourceFile(fileName)
        if (sourceFile) {
          return pipe(
            LSP.getApplicableRefactors(refactors, sourceFile, positionOrRange),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(
              TypeCheckerApi.TypeCheckerApiCache,
              TypeCheckerApi.makeTypeCheckerApiCache()
            ),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
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
                refactors,
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
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(
              TypeCheckerApi.TypeCheckerApiCache,
              TypeCheckerApi.makeTypeCheckerApiCache()
            ),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
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
              Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
              Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
              Nano.provideService(LSP.PluginOptions, pluginOptions),
              Nano.run,
              Either.getOrElse(() => dedupedTagsQuickInfo)
            )
          }
        }

        return dedupedTagsQuickInfo
      }

      return quickInfo
    }

    proxy.getCompletionsAtPosition = (fileName, position, options, formattingSettings, ...args) => {
      const applicableCompletions = languageService.getCompletionsAtPosition(
        fileName,
        position,
        options,
        formattingSettings,
        ...args
      )

      if (pluginOptions.completions) {
        const program = languageService.getProgram()
        if (program) {
          const sourceFile = program.getSourceFile(fileName)
          if (sourceFile) {
            return pipe(
              LSP.getCompletionsAtPosition(
                completions,
                sourceFile,
                position,
                options,
                formattingSettings
              ),
              Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
              Nano.provideService(
                TypeCheckerApi.TypeCheckerApiCache,
                TypeCheckerApi.makeTypeCheckerApiCache()
              ),
              Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
              Nano.provideService(LSP.PluginOptions, pluginOptions),
              Nano.run,
              Either.map((effectCompletions) => (applicableCompletions
                ? {
                  ...applicableCompletions,
                  entries: effectCompletions.concat(applicableCompletions.entries)
                }
                : (effectCompletions.length > 0 ?
                  ({
                    entries: effectCompletions,
                    isGlobalCompletion: false,
                    isMemberCompletion: false,
                    isNewIdentifierLocation: false
                  }) satisfies ts.CompletionInfo :
                  undefined))
              ),
              Either.getOrElse(() => applicableCompletions)
            )
          }
        }
      }

      return applicableCompletions
    }

    return proxy
  }

  return { create }
}

module.exports = init
