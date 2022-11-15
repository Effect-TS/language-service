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
        const effectDiagnostics = AST.getSourceFile(fileName).flatMap(sourceFile =>
          T.forEachPar(
            Object.values<DiagnosticDefinition>(diagnostics).map(applyConfiguredDiagnosticCategory).filter(_ =>
              _.category !== "none"
            ),
            diagnostic =>
              diagnostic.apply(sourceFile).map(results =>
                results.map(_ => ({
                  file: sourceFile,
                  start: _.node.pos,
                  length: _.node.end - _.node.pos,
                  messageText: _.messageText,
                  category: toTsDiagnosticCategory(diagnostic.category),
                  code: diagnostic.code,
                  source: "effect"
                }))
              )
          )
        ).map(v => v.flatten).map(v => Array.from(v))
          .provideService(AST.TypeScriptProgram, program)
          .provideService(AST.TypeScriptApi, modules.typescript)
          .unsafeRunSync()

        return suggestionDiagnostics.concat(effectDiagnostics)
      }
      return suggestionDiagnostics
    }

    /*
    proxy.getCompletionsAtPosition = (...args) => {
      const completions = languageService.getCompletionsAtPosition(...args)
      const [fileName, position] = args
      const program = languageService.getProgram()

      if (program) {
        Do(($) => {
          const sourceFile = $(AST.getSourceFile(fileName))
          if (program) {
            const checker = program.getTypeChecker()
            const { previousToken } = AST.getRelevantTokens(ts)(position, sourceFile)
            const token = previousToken.toNullable
            info.project.projectService.logger.info(
              "[@effect/language-service] previous token is " + token?.getText(sourceFile)
            )
            if (token) {
              const type = checker.getTypeAtLocation(token)
              info.project.projectService.logger.info(
                "[@effect/language-service] previous type is " + checker.typeToString(type)
              )
              let token2 = ts.findPrecedingToken(token.pos, sourceFile)
              while (token2 && !ts.isCallExpression(token2) && !ts.isIdentifier(token2)) {
                token2 = token2.parent
              }
              info.project.projectService.logger.info(
                "[@effect/language-service] token2 is " + token2?.getText(sourceFile)
              )
              if (token2) {
                const type2 = checker.getTypeAtLocation(token2)
                info.project.projectService.logger.info(
                  "[@effect/language-service] type2 is " + checker.typeToString(type2)
                )
                type2.getCallSignatures().map(s => {
                  info.project.projectService.logger.info(
                    "[@effect/language-service] return type2 is " + checker.typeToString(s.getReturnType())
                  )
                })
              }
            }
          }
        }).provideService(AST.TypeScriptProgram, program)
          .provideService(AST.TypeScriptApi, modules.typescript)
          .unsafeRunSync()
      }

      return completions
    }*/

    proxy.getApplicableRefactors = (...args) => {
      const applicableRefactors = languageService.getApplicableRefactors(...args)
      const [fileName, positionOrRange] = args
      const program = languageService.getProgram()

      if (program) {
        const textRange = AST.toTextRange(positionOrRange)
        const effectRefactors = AST.getSourceFile(fileName).flatMap(sourceFile =>
          T.collectAllWith(
            Object.values<RefactorDefinition>(refactors).map(refactor =>
              refactor.apply(sourceFile, textRange).map(canApply =>
                canApply.map(_ => ({
                  name: refactor.name,
                  description: refactor.description,
                  actions: [{
                    name: refactor.name,
                    description: _.description
                  }]
                }))
              )
            ),
            identity
          )
        ).map(v => Array.from(v))
          .provideService(AST.TypeScriptProgram, program)
          .provideService(AST.TypeScriptApi, modules.typescript)
          .unsafeRunSync()

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
            return Do($ => {
              const sourceFile = $(AST.getSourceFile(fileName))
              const textRange = AST.toTextRange(positionOrRange)
              const possibleRefactor = $(refactor.apply(sourceFile, textRange))

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
                changeTracker =>
                  possibleRefactor.value.apply.provideService(AST.ChangeTrackerApi, changeTracker).provideService(
                    AST.TypeScriptApi,
                    modules.typescript
                  )
                    .provideService(AST.TypeScriptProgram, program).unsafeRunSync()
              )

              return { edits }
            }).provideService(AST.TypeScriptApi, modules.typescript)
              .provideService(AST.TypeScriptProgram, program)
              .unsafeRunSync()
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
