import { Either } from "effect"
import { pipe } from "effect/Function"
import type ts from "typescript"
import { completions } from "./completions.js"
import * as LanguageServicePluginOptions from "./core/LanguageServicePluginOptions.js"
import * as LSP from "./core/LSP.js"
import * as Nano from "./core/Nano.js"
import * as TypeCheckerApi from "./core/TypeCheckerApi.js"
import * as TypeParser from "./core/TypeParser.js"
import * as TypeScriptApi from "./core/TypeScriptApi.js"
import { diagnostics } from "./diagnostics.js"
import { goto } from "./goto.js"
import { quickInfo } from "./quickinfo.js"
import { refactors } from "./refactors.js"

const LSP_INJECTED_URI = "@effect/language-service/injected"

const init = (
  modules: {
    typescript: typeof ts
  }
) => {
  let languageServicePluginOptions: LanguageServicePluginOptions.LanguageServicePluginOptions =
    LanguageServicePluginOptions.parse({})

  function onConfigurationChanged(config: any) {
    languageServicePluginOptions = LanguageServicePluginOptions.parse(config)
  }

  function create(info: ts.server.PluginCreateInfo) {
    const languageService = info.languageService
    languageServicePluginOptions = LanguageServicePluginOptions.parse(info.config)

    // prevent double-injection of the effect language service
    if ((languageService as any)[LSP_INJECTED_URI]) return languageService

    info.project.log("[@effect/language-service] Started!")

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
      // eslint-disable-next-line no-empty, @typescript-eslint/no-unused-vars
    } catch (_) {}

    // create the proxy and mark it as injected (to avoid double-applies)
    const proxy: ts.LanguageService = Object.create(null)
    ;(proxy as any)[LSP_INJECTED_URI] = true
    for (const k of Object.keys(languageService) as Array<keyof ts.LanguageService>) {
      // @ts-expect-error
      proxy[k] = (...args: Array<{}>) => languageService[k]!.apply(languageService, args)
    }

    // this is the Nano runner used by all the endpoints
    // it will take a nano, provide some LSP services and run it.
    function runNano(program: ts.Program) {
      return <A, E>(
        fa: Nano.Nano<
          A,
          E,
          | TypeCheckerApi.TypeCheckerApi
          | TypeScriptApi.TypeScriptProgram
          | TypeScriptApi.TypeScriptApi
          | TypeParser.TypeParser
          | LanguageServicePluginOptions.LanguageServicePluginOptions
          | TypeCheckerApi.TypeCheckerApiCache
        >
      ) =>
        pipe(
          fa,
          Nano.provideService(TypeParser.TypeParser, TypeParser.make(modules.typescript, program.getTypeChecker())),
          Nano.provideService(TypeScriptApi.TypeScriptProgram, program),
          Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
          Nano.provideService(
            TypeCheckerApi.TypeCheckerApiCache,
            TypeCheckerApi.makeTypeCheckerApiCache()
          ),
          Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
          Nano.provideService(
            LanguageServicePluginOptions.LanguageServicePluginOptions,
            languageServicePluginOptions
          ),
          Nano.run
        )
    }

    const effectCodeFixesForFile = new Map<
      string,
      Array<LSP.ApplicableDiagnosticDefinitionFixWithPositionAndCode>
    >()
    proxy.getSemanticDiagnostics = (fileName, ...args) => {
      const applicableDiagnostics = languageService.getSemanticDiagnostics(fileName, ...args)
      const program = languageService.getProgram()

      if (languageServicePluginOptions.diagnostics && program) {
        effectCodeFixesForFile.delete(fileName)
        const sourceFile = program.getSourceFile(fileName)

        if (sourceFile) {
          return pipe(
            LSP.getSemanticDiagnosticsWithCodeFixes(diagnostics, sourceFile),
            runNano(program),
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
            runNano(program),
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
            runNano(program)
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
      const applicableQuickInfo = languageService.getQuickInfoAtPosition(fileName, position, ...args)

      if (languageServicePluginOptions.quickinfo) {
        const program = languageService.getProgram()
        if (program) {
          const sourceFile = program.getSourceFile(fileName)
          if (sourceFile) {
            return pipe(
              quickInfo(
                sourceFile,
                position,
                applicableQuickInfo
              ),
              runNano(program),
              Either.getOrElse(() => applicableQuickInfo)
            )
          }
        }
      }

      return applicableQuickInfo
    }

    proxy.getCompletionsAtPosition = (fileName, position, options, formattingSettings, ...args) => {
      const applicableCompletions = languageService.getCompletionsAtPosition(
        fileName,
        position,
        options,
        formattingSettings,
        ...args
      )

      const getModuleSpecifier = TypeScriptApi.makeGetModuleSpecifier(modules.typescript)
      const cache = new Map<string, false | { moduleName: string; moduleSpecifier: string }>()

      if (languageServicePluginOptions.completions) {
        const program = languageService.getProgram()
        if (program) {
          const sourceFile = program.getSourceFile(fileName)
          if (sourceFile) {
            if (applicableCompletions && getModuleSpecifier) {
              const getEffectNamespaceInfo = (entry: ts.CompletionEntry) => {
                const data = entry.data
                if (!data) return
                if (!data.fileName) return
                if (!data.moduleSpecifier) return
                if (!data.exportName) return
                if (cache.has(data.fileName)) return cache.get(data.fileName)!
                const moduleSpecifier = getModuleSpecifier(
                  program.getCompilerOptions(),
                  sourceFile,
                  sourceFile.fileName,
                  data.fileName,
                  program
                )
                const lastIndex = moduleSpecifier.lastIndexOf("/")
                if (lastIndex !== -1) {
                  const moduleName = moduleSpecifier.slice(lastIndex + 1)
                  const result = { moduleName, moduleSpecifier }
                  cache.set(data.fileName, result)
                  return result
                }
                cache.set(data.fileName, false)
              }

              for (const entry of applicableCompletions.entries) {
                const info = getEffectNamespaceInfo(entry)
                if (!info) continue
                entry.data = {
                  ...entry.data,
                  effectModuleName: info.moduleName,
                  effectModuleSpecifier: info.moduleSpecifier
                } as any
                entry.hasAction = true
                entry.insertText = info.moduleName + "." + entry.name
                entry.filterText = entry.name
              }
            }

            return pipe(
              LSP.getCompletionsAtPosition(
                completions,
                sourceFile,
                position,
                options,
                formattingSettings
              ),
              runNano(program),
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

    proxy.getCompletionEntryDetails = (
      fileName,
      position,
      entryName,
      formatOptions,
      source,
      preferences,
      _data,
      ...args
    ) => {
      const applicableCompletionEntryDetails = languageService.getCompletionEntryDetails(
        fileName,
        position,
        entryName,
        formatOptions,
        source,
        preferences,
        _data && "effectModuleName" in _data ? undefined : _data,
        ...args
      )

      console.log(applicableCompletionEntryDetails)

      return applicableCompletionEntryDetails
    }

    proxy.getDefinitionAndBoundSpan = (fileName, position, ...args) => {
      const applicableDefinition = languageService.getDefinitionAndBoundSpan(fileName, position, ...args)

      if (languageServicePluginOptions.goto) {
        const program = languageService.getProgram()
        if (program) {
          const sourceFile = program.getSourceFile(fileName)
          if (sourceFile) {
            return pipe(
              goto(applicableDefinition, sourceFile, position),
              runNano(program),
              Either.getOrElse(() => applicableDefinition)
            )
          }
        }
      }

      return applicableDefinition
    }

    return proxy
  }

  return { create, onConfigurationChanged }
}

module.exports = init
