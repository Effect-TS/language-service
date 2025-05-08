import * as ReadonlyArray from "effect/Array"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type ts from "typescript"
import type * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as Nano from "./Nano.js"

export class RefactorNotApplicableError
  extends Data.TaggedError("RefactorNotApplicableError")<{}>
{}

export interface RefactorDefinition {
  name: string
  description: string
  apply: (
    sourceFile: ts.SourceFile,
    textRange: ts.TextRange
  ) => Nano.Nano<
    ApplicableRefactorDefinition,
    RefactorNotApplicableError,
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApi
    | PluginOptions
    | TypeCheckerApi.TypeCheckerApiCache
  >
}

export interface ApplicableRefactorDefinition {
  kind: string
  description: string
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}

export function createRefactor(definition: RefactorDefinition): RefactorDefinition {
  return definition
}

export interface DiagnosticDefinition {
  name: string
  code: number
  apply: (
    sourceFile: ts.SourceFile
  ) => Nano.Nano<
    Array<ApplicableDiagnosticDefinition>,
    never,
    | TypeCheckerApi.TypeCheckerApi
    | PluginOptions
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApiCache
  >
}

export interface ApplicableDiagnosticDefinition {
  node: ts.Node
  category: ts.DiagnosticCategory
  messageText: string
  fixes: Array<ApplicableDiagnosticDefinitionFix>
}

export interface ApplicableDiagnosticDefinitionFix {
  fixName: string
  description: string
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}

export interface ApplicableDiagnosticDefinitionFixWithPositionAndCode
  extends ApplicableDiagnosticDefinitionFix
{
  code: number
  start: number
  end: number
}

export function createDiagnostic(definition: DiagnosticDefinition): DiagnosticDefinition {
  return definition
}

export interface PluginOptions {
  diagnostics: boolean
  quickinfo: boolean
  completions: boolean
}

export interface CompletionDefinition {
  name: string
  apply: (
    sourceFile: ts.SourceFile,
    position: number,
    options: ts.GetCompletionsAtPositionOptions | undefined,
    formatCodeSettings: ts.FormatCodeSettings | undefined
  ) => Nano.Nano<
    Array<CompletionEntryDefinition>,
    never,
    | TypeCheckerApi.TypeCheckerApi
    | PluginOptions
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApiCache
  >
}

export interface CompletionEntryDefinition {
  name: string
  kind: ts.ScriptElementKind
  insertText: string
  isSnippet: true
  replacementSpan: ts.TextSpan
}

export function createCompletion(definition: CompletionDefinition): CompletionDefinition {
  return definition
}

export const PluginOptions = Nano.Tag<PluginOptions>("PluginOptions")

export class SourceFileNotFoundError extends Data.TaggedError("SourceFileNotFoundError")<{
  fileName: string
}> {}

export const getSemanticDiagnosticsWithCodeFixes = Nano.fn("LSP.getSemanticDiagnostics")(function*(
  rules: Array<DiagnosticDefinition>,
  sourceFile: ts.SourceFile
) {
  const effectDiagnostics: Array<ts.Diagnostic> = []
  const effectCodeFixes: Array<ApplicableDiagnosticDefinitionFixWithPositionAndCode> = []
  const executor = yield* createDiagnosticExecutor(sourceFile)
  for (const rule of rules) {
    const result = yield* (
      Nano.option(executor.execute(rule))
    )
    if (Option.isSome(result)) {
      effectDiagnostics.push(
        ...pipe(
          result.value,
          ReadonlyArray.map((_) => ({
            file: sourceFile,
            start: _.node.getStart(sourceFile),
            length: _.node.getEnd() - _.node.getStart(sourceFile),
            messageText: _.messageText,
            category: _.category,
            code: rule.code,
            source: "effect"
          }))
        )
      )
      effectCodeFixes.push(
        ...pipe(
          result.value,
          ReadonlyArray.map((_) =>
            ReadonlyArray.map(
              _.fixes,
              (fix) => ({
                ...fix,
                code: rule.code,
                start: _.node.getStart(sourceFile),
                end: _.node.getEnd()
              })
            )
          ),
          ReadonlyArray.flatten
        )
      )
    }
  }

  return ({
    diagnostics: effectDiagnostics,
    codeFixes: effectCodeFixes
  })
})

export const getApplicableRefactors = Nano.fn("LSP.getApplicableRefactors")(function*(
  refactors: Array<RefactorDefinition>,
  sourceFile: ts.SourceFile,
  positionOrRange: number | ts.TextRange
) {
  const textRange = typeof positionOrRange === "number"
    ? { pos: positionOrRange, end: positionOrRange }
    : positionOrRange
  const effectRefactors: Array<ts.ApplicableRefactorInfo> = []
  for (const refactor of refactors) {
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
  return effectRefactors
})

export const getEditsForRefactor = Nano.fn("LSP.getEditsForRefactor")(function*(
  refactors: Array<RefactorDefinition>,
  sourceFile: ts.SourceFile,
  positionOrRange: number | ts.TextRange,
  refactorName: string
) {
  const refactor = refactors.find((refactor) => refactor.name === refactorName)
  if (!refactor) {
    return yield* Nano.fail(new RefactorNotApplicableError())
  }
  const textRange = typeof positionOrRange === "number"
    ? { pos: positionOrRange, end: positionOrRange }
    : positionOrRange

  return yield* refactor.apply(sourceFile, textRange)
})

export const getCompletionsAtPosition = Nano.fn("LSP.getCompletionsAtPosition")(function*(
  completions: Array<CompletionDefinition>,
  sourceFile: ts.SourceFile,
  position: number,
  options: ts.GetCompletionsAtPositionOptions | undefined,
  formatCodeSettings: ts.FormatCodeSettings | undefined
) {
  const effectCompletions: Array<ts.CompletionEntry> = []
  for (const completion of completions) {
    const result = yield* completion.apply(sourceFile, position, options, formatCodeSettings)
    effectCompletions.push(
      ...result.map((_) => ({ sortText: "11", ..._ }) satisfies ts.CompletionEntry)
    )
  }
  return effectCompletions
})

const createDiagnosticExecutor = Nano.fn("LSP.createCommentDirectivesProcessor")(
  function*(sourceFile: ts.SourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)

    const ruleOverrides: Record<
      string,
      Array<{ start: number; end: number; level: string }>
    > = {}
    const skippedRules: Array<string> = []

    const regex =
      /@effect-diagnostics((?:\s[a-zA-Z0-9/]+:(?:off|warning|error|message|suggestion|skip-file))+)?/gm
    let match: RegExpExecArray | null
    while ((match = regex.exec(sourceFile.text)) !== null) {
      const rulesCaptureGroup = match[1]

      if (rulesCaptureGroup) {
        const trimmedRuleString = rulesCaptureGroup.trim()
        if (trimmedRuleString) {
          const individualRules = trimmedRuleString.split(/\s+/)
          for (const rulePair of individualRules) {
            const [ruleName, ruleLevel] = rulePair.toLowerCase().split(":")
            if (ruleName && ruleLevel) {
              if (ruleLevel === "skip-file") skippedRules.push(ruleName)
              ruleOverrides[ruleName] = ruleOverrides[ruleName] || []
              const newLength = ruleOverrides[ruleName].push({
                start: match.index,
                end: Number.MAX_SAFE_INTEGER,
                level: ruleLevel
              })
              if (newLength > 1) ruleOverrides[ruleName][newLength - 2].end = match.index
            }
          }
        }
      }
    }

    const levelToDiagnosticCategory: Record<string, ts.DiagnosticCategory> = {
      error: ts.DiagnosticCategory.Error,
      warning: ts.DiagnosticCategory.Warning,
      message: ts.DiagnosticCategory.Message,
      suggestion: ts.DiagnosticCategory.Suggestion
    }

    const execute = Nano.fn("LSP.ruleExecutor")(function*(
      rule: DiagnosticDefinition
    ) {
      const ruleNameLowered = rule.name.toLowerCase()
      // if file is skipped entirely, do not process the rule
      if (skippedRules.indexOf(ruleNameLowered) > -1) return []
      // run the executor
      let modifiedDiagnostics = yield* rule.apply(sourceFile)
      // apply overrides
      for (const override of (ruleOverrides[ruleNameLowered] || [])) {
        if (override.level === "off") {
          // remove from output those in range
          modifiedDiagnostics = modifiedDiagnostics.filter((_) =>
            !(_.node.getStart(sourceFile) >= override.start && _.node.getEnd() <= override.end)
          )
        } else {
          // change severity
          for (
            const message of modifiedDiagnostics.filter((_) =>
              _.node.getStart(sourceFile) >= override.start && _.node.getEnd() <= override.end
            )
          ) {
            message.category = override.level in levelToDiagnosticCategory
              ? levelToDiagnosticCategory[override.level]
              : message.category
          }
        }
      }

      // append a rule fix to disable this check for the entire file
      const fixByDisableEntireFile: ApplicableDiagnosticDefinitionFix = {
        fixName: rule.name + "_skipFile",
        description: "Disable " + rule.name + " for this file",
        apply: Nano.flatMap(
          Nano.service(TypeScriptApi.ChangeTracker),
          (changeTracker) =>
            Nano.sync(() =>
              changeTracker.insertText(
                sourceFile,
                0,
                `/** @effect-diagnostics ${rule.name}:skip-file */` + "\n"
              )
            )
        )
      }
      const rulesWithDisableFix = modifiedDiagnostics.map((diagnostic) => ({
        ...diagnostic,
        fixes: diagnostic.fixes.concat([fixByDisableEntireFile])
      }))

      return rulesWithDisableFix
    })

    return { execute }
  }
)
