import * as ReadonlyArray from "effect/Array"
import * as Option from "effect/Option"
import type ts from "typescript"
import type * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import type * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as LanguageServicePluginOptions from "./LanguageServicePluginOptions.js"
import * as Nano from "./Nano.js"

export class RefactorNotApplicableError {
  readonly _tag = "@effect/language-service/RefactorNotApplicableError"
}

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
    | TypeParser.TypeParser
    | LanguageServicePluginOptions.LanguageServicePluginOptions
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

type KnownNodes =
  | ts.SourceFile
  | ts.CallExpression
  | ts.YieldExpression
  | ts.ReturnStatement
  | ts.ExpressionStatement
  | ts.ClassDeclaration
export type DiagnosticMatcher = {
  [K in KnownNodes as K["kind"]]?: (node: K) => Nano.Nano<void>
}

export interface DiagnosticDefinition {
  name: string
  code: number
  apply: (
    report: (data: ApplicableDiagnosticDefinition) => void
  ) => Nano.Nano<
    DiagnosticMatcher,
    never,
    | TypeCheckerApi.TypeCheckerApi
    | TypeParser.TypeParser
    | LanguageServicePluginOptions.LanguageServicePluginOptions
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApiCache
    | TypeScriptApi.TypeScriptProgram
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

export interface ApplicableDiagnosticDefinitionFixWithPositionAndCode extends ApplicableDiagnosticDefinitionFix {
  code: number
  start: number
  end: number
}

export function createDiagnostic(definition: DiagnosticDefinition): DiagnosticDefinition {
  return definition
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
    | TypeParser.TypeParser
    | LanguageServicePluginOptions.LanguageServicePluginOptions
    | TypeScriptApi.TypeScriptApi
    | TypeCheckerApi.TypeCheckerApiCache
    | TypeScriptApi.TypeScriptProgram
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

export class SourceFileNotFoundError {
  readonly _tag = "@effect/language-service/SourceFileNotFoundError"
  constructor(
    readonly fileName: string
  ) {}
}

function refactorNameToFullyQualifiedName(name: string) {
  return `@effect/language-service/refactors/${name}`
}

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
        name: refactorNameToFullyQualifiedName(refactor.name),
        description: refactor.description,
        actions: [{
          name: refactorNameToFullyQualifiedName(refactor.name),
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
  const refactor = refactors.find((refactor) => refactorNameToFullyQualifiedName(refactor.name) === refactorName)
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
  let effectCompletions: Array<ts.CompletionEntry> = []
  for (const completion of completions) {
    const result = yield* completion.apply(sourceFile, position, options, formatCodeSettings)
    effectCompletions = effectCompletions.concat(
      result.map((_) => ({ sortText: "11", ..._ }) satisfies ts.CompletionEntry)
    )
  }
  return effectCompletions
})

export const getSemanticDiagnosticsWithCodeFixes = Nano.fn(
  "LSP.getSemanticDiagnosticsWithCodeFixes"
)(function*(
  rules: Array<DiagnosticDefinition>,
  sourceFile: ts.SourceFile
) {
  const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
  const pluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

  function findNodeWithLeadingCommentAtPosition(position: number) {
    const sourceText = sourceFile.text
    let result: ts.Node | undefined

    function find(node: ts.Node) {
      // Check leading comments
      const leading = ts.getLeadingCommentRanges(sourceText, node.getFullStart())
      if (leading) {
        for (const r of leading) {
          if (r.pos <= position && position < r.end) {
            // we found the comment
            result = node
            return
          }
        }
      }
      // Continue traversing only if the position is within this node
      if (node.getFullStart() <= position && position < node.getEnd()) {
        node.forEachChild(find)
      }
    }
    find(sourceFile)
    return result
  }

  function findParentStatementForDisableNextLine(node: ts.Node) {
    let result: ts.Node | undefined

    function find(node: ts.Node) {
      if (ts.isStatement(node)) {
        result = node
        return
      }
      if (result) return
      if (node.parent) find(node.parent)
    }
    find(node)
    return result || node
  }

  const lineOverrides: Record<
    string,
    Array<{ pos: number; end: number; level: string }>
  > = {}
  const sectionOverrides: Record<
    string,
    Array<{ pos: number; level: string }>
  > = {}
  const skippedRules: Array<string> = []

  const regex =
    /@effect-diagnostics(-next-line)?((?:\s[a-zA-Z0-9/]+:(?:off|warning|error|message|suggestion|skip-file))+)?/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(sourceFile.text)) !== null) {
    const nextLineCaptureGroup = match[1]
    const rulesCaptureGroup = match[2]

    if (rulesCaptureGroup) {
      const trimmedRuleString = rulesCaptureGroup.trim()
      if (trimmedRuleString) {
        const individualRules = trimmedRuleString.split(/\s+/)
        for (const rulePair of individualRules) {
          const [rawRuleName, ruleLevel] = rulePair.toLowerCase().split(":")
          // NOTE: for backwards compatibility, treat "effect/ruleName" same as "ruleName"
          const ruleName = rawRuleName.startsWith("effect/")
            ? rawRuleName.substring("effect/".length)
            : rawRuleName
          if (ruleName && ruleLevel) {
            if (ruleLevel === "skip-file") skippedRules.push(ruleName)
            const isOverrideNextLine = nextLineCaptureGroup &&
              nextLineCaptureGroup.trim().toLowerCase() === "-next-line"
            if (isOverrideNextLine) {
              const node = findNodeWithLeadingCommentAtPosition(match.index)
              if (node) {
                lineOverrides[ruleName] = lineOverrides[ruleName] || []
                lineOverrides[ruleName].unshift({
                  pos: node.getFullStart(),
                  end: node.end,
                  level: ruleLevel
                })
              }
            } else {
              sectionOverrides[ruleName] = sectionOverrides[ruleName] || []
              sectionOverrides[ruleName].unshift({
                pos: match.index,
                level: ruleLevel
              })
            }
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

  const allMatcher: Record<string, (node: ts.Node) => Nano.Nano<void>> = {}
  let diagnostics: Array<ts.Diagnostic> = []
  let codeFixes: Array<ApplicableDiagnosticDefinitionFixWithPositionAndCode> = []

  // process each rule
  for (const rule of rules) {
    const ruleNameLowered = rule.name.toLowerCase()
    // if file is skipped entirely, do not process the rule
    if (skippedRules.indexOf(ruleNameLowered) > -1) continue
    // append a rule fix to disable this check only for next line
    const fixByDisableNextLine = (
      _: ApplicableDiagnosticDefinition
    ): ApplicableDiagnosticDefinitionFix => ({
      fixName: rule.name + "_skipNextLine",
      description: "Disable " + rule.name + " for this line",
      apply: Nano.flatMap(
        Nano.service(TypeScriptApi.ChangeTracker),
        (changeTracker) =>
          Nano.sync(() => {
            const disableAtNode = findParentStatementForDisableNextLine(_.node)
            const { line } = ts.getLineAndCharacterOfPosition(sourceFile, disableAtNode.getStart())

            changeTracker.insertCommentBeforeLine(
              sourceFile,
              line,
              disableAtNode.getStart(),
              ` @effect-diagnostics-next-line ${rule.name}:off`
            )
          })
      )
    })

    // append a rule fix to disable this check for the entire file
    const fixByDisableEntireFile: ApplicableDiagnosticDefinitionFix = {
      fixName: rule.name + "_skipFile",
      description: "Disable " + rule.name + " for this entire file",
      apply: Nano.flatMap(
        Nano.service(TypeScriptApi.ChangeTracker),
        (changeTracker) =>
          Nano.sync(() =>
            changeTracker.insertText(
              sourceFile,
              0,
              `/** @effect-diagnostics ${rule.name}:skip-file */\n`
            )
          )
      )
    }
    // run the executor
    const matchers = yield* rule.apply((entry) => {
      // by default, use the overriden level from the plugin options
      let newLevel: string | undefined = pluginOptions.diagnosticSeverity[ruleNameLowered]
      // attempt with line overrides
      const lineOverride = (lineOverrides[ruleNameLowered] || []).find((_) =>
        _.pos < entry.node.getStart(sourceFile) && _.end >= entry.node.getEnd()
      )
      if (lineOverride) {
        newLevel = lineOverride.level
      } else {
        // then attempt with section overrides
        const sectionOverride = (sectionOverrides[ruleNameLowered] || []).find((_) =>
          _.pos < entry.node.getStart(sourceFile)
        )
        if (sectionOverride) newLevel = sectionOverride.level
      }
      // if off, do not emit the diagnostic
      if (newLevel === "off") return
      // final applicable diagnostic
      const _: ApplicableDiagnosticDefinition = {
        ...entry,
        category: newLevel && newLevel in levelToDiagnosticCategory
          ? levelToDiagnosticCategory[newLevel]
          : entry.category,
        fixes: entry.fixes.concat([fixByDisableNextLine(entry), fixByDisableEntireFile])
      }
      diagnostics = diagnostics.concat([{
        file: sourceFile,
        start: _.node.getStart(sourceFile),
        length: _.node.getEnd() - _.node.getStart(sourceFile),
        messageText: _.messageText,
        category: _.category,
        code: rule.code,
        source: "effect"
      }])
      codeFixes = codeFixes.concat(ReadonlyArray.map(
        _.fixes,
        (fix) => ({
          ...fix,
          code: rule.code,
          start: _.node.getStart(sourceFile),
          end: _.node.getEnd()
        })
      ))
    })
    for (const nodeKind of Object.keys(matchers)) {
      const prevMatcher = allMatcher[nodeKind]
      const newMatcher = (matchers as any)[nodeKind]
      allMatcher[nodeKind] = prevMatcher
        ? (node) => Nano.flatMap(prevMatcher(node), () => newMatcher(node))
        : newMatcher
    }
  }

  // real execution
  const nodeToVisit: Array<ts.Node> = [sourceFile]
  const appendNodeToVisit = (node: ts.Node) => {
    nodeToVisit.push(node)
    return undefined
  }

  while (nodeToVisit.length > 0) {
    const node = nodeToVisit.shift()!
    ts.forEachChild(node, appendNodeToVisit)
    if (node.kind in allMatcher) yield* allMatcher[node.kind](node)
  }

  return { diagnostics, codeFixes }
})
