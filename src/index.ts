/**
 * @since 1.0.0
 */
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import type { PluginOptions } from "./definition.js"
import { diagnostics } from "./diagnostics.js"
import { dedupeJsDocTags } from "./quickinfo.js"
import { refactors } from "./refactors.js"
import * as AST from "./utils/AST.js"

const init = (
  modules: {
    typescript: typeof ts
  }
) => {
  const ts = modules.typescript

  function create(info: ts.server.PluginCreateInfo) {
    const languageService = info.languageService
    const pluginOptions: PluginOptions = {
      diagnostics:
        info.config && "diagnostics" in info.config && typeof info.config.diagnostics === "boolean"
          ? info.config.diagnostics
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
        const effectDiagnostics: Array<ts.Diagnostic> = pipe(
          Option.fromNullable(program.getSourceFile(fileName)),
          Option.map((sourceFile) =>
            pipe(
              Object.values(diagnostics).map((diagnostic) =>
                pipe(
                  diagnostic.apply(modules.typescript, program, pluginOptions)(
                    sourceFile,
                    applicableDiagnostics
                  ).map((_) => ({
                    file: sourceFile,
                    start: _.node.getStart(sourceFile),
                    length: _.node.getEnd() - _.node.getStart(sourceFile),
                    messageText: _.messageText,
                    category: _.category,
                    code: diagnostic.code,
                    source: "effect"
                  }))
                )
              ),
              (_) =>
                _.reduce(
                  (arr, maybeRefactor) => arr.concat(maybeRefactor),
                  [] as Array<ts.Diagnostic>
                )
            )
          ),
          Option.getOrElse(() => [])
        )

        return effectDiagnostics.concat(applicableDiagnostics)
      }

      return applicableDiagnostics
    }

    proxy.getApplicableRefactors = (...args) => {
      const applicableRefactors = languageService.getApplicableRefactors(...args)
      const [fileName, positionOrRange] = args
      const program = languageService.getProgram()

      if (program) {
        const textRange = AST.toTextRange(positionOrRange)
        const effectRefactors: Array<ts.ApplicableRefactorInfo> = pipe(
          Option.fromNullable(program.getSourceFile(fileName)),
          Option.map((sourceFile) =>
            pipe(
              Object.values(refactors).map((refactor) =>
                pipe(
                  refactor.apply(modules.typescript, program, pluginOptions)(
                    sourceFile,
                    textRange
                  ),
                  Option.map((_) => ({
                    name: refactor.name,
                    description: refactor.description,
                    actions: [{
                      name: refactor.name,
                      description: _.description,
                      kind: _.kind
                    }]
                  }))
                )
              ),
              (_) =>
                _.reduce(
                  (arr, maybeRefactor) =>
                    arr.concat(Option.isSome(maybeRefactor) ? [maybeRefactor.value] : []),
                  [] as Array<ts.ApplicableRefactorInfo>
                )
            )
          ),
          Option.getOrElse(() => [])
        )

        info.project.projectService.logger.info(
          "[@effect/language-service] possible refactors are " + JSON.stringify(effectRefactors)
        )

        return applicableRefactors.concat(effectRefactors)
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
        for (const refactor of Object.values(refactors)) {
          if (refactor.name === refactorName) {
            const textRange = AST.toTextRange(positionOrRange)
            const possibleRefactor = pipe(
              Option.fromNullable(program.getSourceFile(fileName)),
              Option.flatMap((sourceFile) =>
                refactor.apply(modules.typescript, program, pluginOptions)(
                  sourceFile,
                  textRange
                )
              )
            )

            if (Option.isNone(possibleRefactor)) {
              info.project.projectService.logger.info(
                "[@effect/language-service] requested refactor " + refactorName +
                  " is not applicable"
              )
              return { edits: [] }
            }

            const formatContext = ts.formatting.getFormatContext(
              formatOptions,
              info.languageServiceHost
            )
            const edits = ts.textChanges.ChangeTracker.with(
              {
                formatContext,
                host: info.languageServiceHost,
                preferences: preferences || {}
              },
              (changeTracker) => possibleRefactor.value.apply(changeTracker)
            )

            return { edits }
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

      if (quickInfo) {
        return dedupeJsDocTags(quickInfo)
      }

      return quickInfo
    }

    return proxy
  }

  return { create }
}

module.exports = init
