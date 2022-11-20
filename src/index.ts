import * as T from "@effect/core/io/Effect"
import * as AST from "@effect/language-service/ast"
import { parseLanguageServicePluginConfig } from "@effect/language-service/config"
import type {
  DiagnosticDefinition,
  DiagnosticDefinitionMessageCategory
} from "@effect/language-service/diagnostics/definition"
import diagnostics from "@effect/language-service/diagnostics/index"
import type { RefactorDefinition } from "@effect/language-service/refactors/definition"
import refactors from "@effect/language-service/refactors/index"
import { pipe } from "@fp-ts/data/Function"
import * as Ch from "@tsplus/stdlib/collections/Chunk"
import { identity } from "@tsplus/stdlib/data/Function"
import * as O from "@tsplus/stdlib/data/Maybe"
import type ts from "typescript/lib/tsserverlibrary"

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export default function init(modules: { typescript: typeof import("typescript/lib/tsserverlibrary") }) {
  const ts = modules.typescript

  function create(info: ts.server.PluginCreateInfo) {
    const languageService = info.languageService

    // create the proxy
    const proxy: ts.LanguageService = Object.create(null)
    for (const k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
      // @ts-expect-error
      proxy[k] = (...args: Array<{}>) => languageService[k]!.apply(languageService, args)
    }

    function applyConfiguredDiagnosticCategory(diagnostic: DiagnosticDefinition): DiagnosticDefinition {
      const config = parseLanguageServicePluginConfig(info.config)
      const category = config.diagnostics[diagnostic.code] || diagnostic.category
      return ({ ...diagnostic, category })
    }

    function toTsDiagnosticCategory(category: DiagnosticDefinitionMessageCategory): ts.DiagnosticCategory {
      return ({
        none: ts.DiagnosticCategory.Suggestion,
        suggestion: ts.DiagnosticCategory.Suggestion,
        warning: ts.DiagnosticCategory.Warning,
        error: ts.DiagnosticCategory.Error
      })[category]
    }

    proxy.getSuggestionDiagnostics = (...args) => {
      const suggestionDiagnostics = languageService.getSuggestionDiagnostics(...args)
      const [fileName] = args
      const program = languageService.getProgram()

      if (program) {
        const effectDiagnostics = pipe(
          AST.getSourceFile(fileName),
          T.flatMap((sourceFile) =>
            T.forEachPar(
              Object.values<DiagnosticDefinition>(diagnostics).map(applyConfiguredDiagnosticCategory).filter((_) =>
                _.category !== "none"
              ),
              (diagnostic) =>
                pipe(
                  diagnostic.apply(sourceFile),
                  T.map(Ch.map((_) => ({
                    file: sourceFile,
                    start: _.node.pos,
                    length: _.node.end - _.node.pos,
                    messageText: _.messageText,
                    category: toTsDiagnosticCategory(diagnostic.category),
                    code: diagnostic.code,
                    source: "effect"
                  })))
                )
            )
          ),
          T.map(Ch.flatten),
          T.map((v) => Array.from(v)),
          T.provideService(AST.TypeScriptProgram, program),
          T.provideService(AST.TypeScriptApi, modules.typescript),
          T.unsafeRunSync
        )

        return suggestionDiagnostics.concat(effectDiagnostics)
      }
      return suggestionDiagnostics
    }

    proxy.getApplicableRefactors = (...args) => {
      const applicableRefactors = languageService.getApplicableRefactors(...args)
      const [fileName, positionOrRange] = args
      const program = languageService.getProgram()

      if (program) {
        const textRange = AST.toTextRange(positionOrRange)
        const effectRefactors = pipe(
          AST.getSourceFile(fileName),
          T.flatMap((sourceFile) =>
            T.collectAllWith(
              Object.values<RefactorDefinition>(refactors).map((refactor) =>
                pipe(
                  refactor.apply(sourceFile, textRange),
                  T.map(O.map((_) => ({
                    name: refactor.name,
                    description: refactor.description,
                    actions: [{
                      name: refactor.name,
                      description: _.description
                    }]
                  })))
                )
              ),
              identity
            )
          ),
          T.map((v) => Array.from(v)),
          T.provideService(AST.TypeScriptProgram, program),
          T.provideService(AST.TypeScriptApi, modules.typescript),
          T.unsafeRunSync
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
            return pipe(
              T.gen(function*($) {
                const sourceFile = yield* $(AST.getSourceFile(fileName))
                const textRange = AST.toTextRange(positionOrRange)
                const possibleRefactor = yield* $(refactor.apply(sourceFile, textRange))

                if (O.isNone(possibleRefactor)) {
                  info.project.projectService.logger.info(
                    "[@effect/language-service] requested refactor " + refactorName + " is not applicable"
                  )
                  return { edits: [] }
                }

                const formatContext = ts.formatting.getFormatContext(formatOptions, info.languageServiceHost)
                const edits = ts.textChanges.ChangeTracker.with(
                  {
                    formatContext,
                    host: info.languageServiceHost,
                    preferences: preferences || {}
                  },
                  (changeTracker) =>
                    pipe(
                      possibleRefactor.value.apply,
                      T.provideService(AST.ChangeTrackerApi, changeTracker),
                      T.provideService(
                        AST.TypeScriptApi,
                        modules.typescript
                      ),
                      T.provideService(AST.TypeScriptProgram, program),
                      T.unsafeRunSync
                    )
                )

                return { edits }
              }),
              T.provideService(AST.TypeScriptApi, modules.typescript),
              T.provideService(AST.TypeScriptProgram, program),
              T.unsafeRunSync
            )
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

    return proxy
  }

  return { create }
}
