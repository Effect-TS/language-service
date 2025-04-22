import { Either } from "effect"
import * as ReadonlyArray from "effect/Array"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import { PluginOptions } from "./definition.js"
import { diagnostics } from "./diagnostics.js"
import { dedupeJsDocTags, prependEffectTypeArguments } from "./quickinfo.js"
import { refactors } from "./refactors.js"
import * as AST from "./utils/AST.js"
import * as Nano from "./utils/Nano.js"
import * as TypeCheckerApi from "./utils/TypeCheckerApi.js"
import * as TypeScriptApi from "./utils/TypeScriptApi.js"

const init = (
  modules: {
    typescript: typeof ts
  }
) => {
  function create(info: ts.server.PluginCreateInfo) {
    const languageService = info.languageService
    const pluginOptions: PluginOptions = {
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
            Nano.gen(function*() {
              const effectDiagnostics: Array<ts.Diagnostic> = []
              for (const diagnostic of Object.values(diagnostics)) {
                const result = yield* Nano.option(diagnostic.apply(sourceFile))
                if (Option.isSome(result)) {
                  effectDiagnostics.push(...result.value.map((_) => ({
                    file: sourceFile,
                    start: _.node.getStart(sourceFile),
                    length: _.node.getEnd() - _.node.getStart(sourceFile),
                    messageText: _.messageText,
                    category: _.category,
                    code: diagnostic.code,
                    source: "effect"
                  })))
                }
              }
              return effectDiagnostics.concat(applicableDiagnostics)
            }),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(PluginOptions, pluginOptions),
            Nano.run,
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
        const textRange = AST.toTextRange(positionOrRange)
        const sourceFile = program.getSourceFile(fileName)
        if (sourceFile) {
          return pipe(
            Nano.gen(function*() {
              const effectRefactors: Array<ts.ApplicableRefactorInfo> = []
              for (const refactor of Object.values(refactors)) {
                const result = yield* Nano.option(refactor.apply(sourceFile, textRange))
                if (Option.isSome(result)) {
                  effectRefactors.push({
                    name: refactor.name,
                    description: refactor.description,
                    actions: [{
                      name: refactor.name,
                      description: result.value.description,
                      kind: result.value.kind
                    }]
                  })
                }
              }
              return applicableRefactors.concat(effectRefactors)
            }),
            Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
            Nano.provideService(PluginOptions, pluginOptions),
            Nano.run,
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
          const textRange = AST.toTextRange(positionOrRange)
          const refactor = ReadonlyArray.findFirst(
            Object.values(refactors),
            (refactor) => refactor.name === refactorName
          )
          if (Option.isSome(refactor)) {
            const result = pipe(
              Nano.gen(function*() {
                const applicableRefactor = yield* refactor.value.apply(sourceFile, textRange)

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

                return edits
              }),
              Nano.provideService(TypeScriptApi.TypeScriptApi, modules.typescript),
              Nano.provideService(TypeCheckerApi.TypeCheckerApi, program.getTypeChecker()),
              Nano.provideService(PluginOptions, pluginOptions),
              Nano.run
            )
            if (Either.isRight(result)) {
              return { edits: result.right }
            }
          }
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
