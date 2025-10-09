import { pipe } from "effect/Function"
import type ts from "typescript"
import type * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import type * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import type * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"
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
    | TypeScriptUtils.TypeScriptUtils
    | TypeCheckerApi.TypeCheckerApi
    | TypeCheckerUtils.TypeCheckerUtils
    | TypeParser.TypeParser
    | LanguageServicePluginOptions.LanguageServicePluginOptions
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
  severity: LanguageServicePluginOptions.DiagnosticSeverity | "off"
  apply: (
    sourceFile: ts.SourceFile,
    report: (data: {
      location: ts.TextRange | ts.Node
      messageText: string
      fixes: Array<ApplicableDiagnosticDefinitionFix>
    }) => void
  ) => Nano.Nano<
    void,
    never,
    | TypeCheckerApi.TypeCheckerApi
    | TypeParser.TypeParser
    | LanguageServicePluginOptions.LanguageServicePluginOptions
    | TypeScriptApi.TypeScriptApi
    | TypeScriptUtils.TypeScriptUtils
    | TypeCheckerUtils.TypeCheckerUtils
    | TypeScriptApi.TypeScriptProgram
  >
}

export interface ApplicableDiagnosticDefinition {
  range: ts.TextRange
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

export function concatDiagnostics(fa: Array<ts.Diagnostic>, fb: Array<ts.Diagnostic>): Array<ts.Diagnostic> {
  const result = fa.slice(0)
  for (const b of fb) {
    const existing = result.find((a) =>
      a.file === b.file && a.code === b.code && a.source === b.source && a.start === b.start && a.length === b.length &&
      a.messageText === b.messageText
    )
    if (!existing) {
      result.push(b)
    }
  }
  return result
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
    | TypeScriptUtils.TypeScriptUtils
    | TypeCheckerUtils.TypeCheckerUtils
    | TypeScriptApi.TypeScriptProgram
  >
}

export interface CompletionEntryDefinition {
  name: string
  kind: ts.ScriptElementKind
  insertText: string
  isSnippet: true
  replacementSpan?: ts.TextSpan
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

export const getSemanticDiagnosticsWithCodeFixes = Nano.fn(
  "LSP.getSemanticDiagnosticsWithCodeFixes"
)(function*(
  rules: Array<DiagnosticDefinition>,
  sourceFile: ts.SourceFile
) {
  let effectDiagnostics: Array<ts.Diagnostic> = []
  let effectCodeFixes: Array<ApplicableDiagnosticDefinitionFixWithPositionAndCode> = []
  const executor = yield* createDiagnosticExecutor(sourceFile)
  for (const rule of rules) {
    const { codeFixes, diagnostics } = yield* (executor.execute(rule))
    effectDiagnostics = effectDiagnostics.concat(diagnostics)
    effectCodeFixes = effectCodeFixes.concat(codeFixes)
  }

  return ({
    diagnostics: effectDiagnostics,
    codeFixes: effectCodeFixes
  })
})

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
    yield* pipe(
      refactor.apply(sourceFile, textRange),
      Nano.map((result) =>
        effectRefactors.push({
          name: refactorNameToFullyQualifiedName(refactor.name),
          description: refactor.description,
          actions: [{
            name: refactorNameToFullyQualifiedName(refactor.name),
            description: result.description,
            kind: result.kind
          }]
        })
      ),
      Nano.ignore
    )
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

const createDiagnosticExecutor = Nano.fn("LSP.createCommentDirectivesProcessor")(
  function*(sourceFile: ts.SourceFile) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const pluginOptions = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

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
                const foundNode = tsUtils.findNodeWithLeadingCommentAtPosition(sourceFile, match.index)
                if (foundNode) {
                  lineOverrides[ruleName] = lineOverrides[ruleName] || []
                  lineOverrides[ruleName].unshift({
                    pos: foundNode.node.pos,
                    end: foundNode.node.end,
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

    const execute = (
      rule: DiagnosticDefinition
    ) =>
      Nano.gen(function*() {
        const diagnostics: Array<ts.Diagnostic> = []
        const codeFixes: Array<ApplicableDiagnosticDefinitionFixWithPositionAndCode> = []
        const ruleNameLowered = rule.name.toLowerCase()
        const defaultLevel = pluginOptions.diagnosticSeverity[ruleNameLowered] || rule.severity
        // if file is skipped entirely, do not process the rule
        if (skippedRules.indexOf(ruleNameLowered) > -1) return { diagnostics, codeFixes }
        // if the default level is off, and there are no overrides, do not process the rule
        if (
          defaultLevel === "off" &&
          ((lineOverrides[ruleNameLowered] || sectionOverrides[ruleNameLowered] || []).length === 0)
        ) {
          return { diagnostics, codeFixes }
        }
        // append a rule fix to disable this check only for next line
        const fixByDisableNextLine = (
          node: ts.Node
        ): ApplicableDiagnosticDefinitionFix => ({
          fixName: rule.name + "_skipNextLine",
          description: "Disable " + rule.name + " for this line",
          apply: Nano.flatMap(
            Nano.service(TypeScriptApi.ChangeTracker),
            (changeTracker) =>
              Nano.gen(function*() {
                const disableAtNode = findParentStatementForDisableNextLine(node)
                const start = ts.getTokenPosOfNode(disableAtNode, sourceFile)
                const { line } = ts.getLineAndCharacterOfPosition(sourceFile, start)

                changeTracker.insertCommentBeforeLine(
                  sourceFile,
                  line,
                  start,
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
        const applicableDiagnostics: Array<ApplicableDiagnosticDefinition> = []
        yield* rule.apply(sourceFile, (entry) => {
          const range = "kind" in entry.location
            ? { pos: ts.getTokenPosOfNode(entry.location, sourceFile), end: entry.location.end }
            : entry.location
          const node = "kind" in entry.location
            ? entry.location
            : tsUtils.findNodeAtPositionIncludingTrivia(sourceFile, entry.location.pos)
          applicableDiagnostics.push({
            range,
            messageText: pluginOptions.diagnosticsName
              ? `${entry.messageText}    effect(${rule.name})`
              : entry.messageText,
            fixes: entry.fixes.concat(node ? [fixByDisableNextLine(node)] : []).concat([fixByDisableEntireFile])
          })
        })

        // loop through rules
        for (const emitted of applicableDiagnostics.slice(0)) {
          // by default, use the overriden level from the plugin options
          let newLevel: string | undefined = defaultLevel
          // attempt with line overrides
          const lineOverride = (lineOverrides[ruleNameLowered] || []).find((_) =>
            _.pos < emitted.range.pos && _.end >= emitted.range.end
          )
          if (lineOverride) {
            newLevel = lineOverride.level
          } else {
            // then attempt with section overrides
            const sectionOverride = (sectionOverrides[ruleNameLowered] || []).find((_) => _.pos < emitted.range.pos)
            if (sectionOverride) newLevel = sectionOverride.level
          }
          // if level is off or not a valid level, skip and no output
          if (!(newLevel in levelToDiagnosticCategory)) continue
          // append both diagnostic and code fix
          diagnostics.push({
            file: sourceFile,
            start: emitted.range.pos,
            length: emitted.range.end - emitted.range.pos,
            messageText: emitted.messageText,
            category: levelToDiagnosticCategory[newLevel],
            code: rule.code,
            source: "effect"
          })
          // append code fixes
          for (const fix of emitted.fixes) {
            codeFixes.push({
              ...fix,
              code: rule.code,
              start: emitted.range.pos,
              end: emitted.range.end
            })
          }
        }

        return { diagnostics, codeFixes }
      })

    return { execute }
  }
)

export const cyrb53 = (str: string, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  // return 4294967296 * (2097151 & h2) + (h1 >>> 0)
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")
}

export class CodegenNotApplicableError {
  readonly _tag = "@effect/language-service/CodegenNotApplicableError"
  constructor(
    readonly cause: string
  ) {}
}

export interface CodegenDefinition {
  name: string
  apply: (
    sourceFile: ts.SourceFile,
    commentRange: ts.TextRange
  ) => Nano.Nano<
    ApplicableCodegenDefinition,
    CodegenNotApplicableError,
    | TypeScriptApi.TypeScriptApi
    | TypeScriptUtils.TypeScriptUtils
    | TypeCheckerApi.TypeCheckerApi
    | TypeCheckerUtils.TypeCheckerUtils
    | TypeParser.TypeParser
    | LanguageServicePluginOptions.LanguageServicePluginOptions
  >
}

export interface ApplicableCodegenDefinition {
  hash: string
  description: string
  apply: Nano.Nano<void, never, ts.textChanges.ChangeTracker>
}

export function createCodegen(definition: CodegenDefinition): CodegenDefinition {
  return definition
}

export const getCodegensForSourceFile = Nano.fn("LSP.getApplicableCodegens")(function*(
  codegens: Array<CodegenDefinition>,
  sourceFile: ts.SourceFile
) {
  const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
  const result: Array<{ codegen: CodegenDefinition; hash: string; range: ts.TextRange }> = []

  const regex = /@effect-codegens((?:\s[a-zA-Z0-9]+(?::(?:[a-zA-Z0-9]+))?)+)+/gmid
  let match: RegExpExecArray | null
  while ((match = regex.exec(sourceFile.text)) !== null) {
    const pos = match.indices?.[0]?.[0]
    if (!pos) continue
    const commentRange = tsUtils.getCommentAtPosition(sourceFile, pos)
    if (!commentRange) continue
    const commentText = sourceFile.text.slice(pos, commentRange.end)
    const codegenRegex = /(\s+)(\w+)(?::(\w+))?/gmi
    let codegenMatch: RegExpExecArray | null
    while ((codegenMatch = codegenRegex.exec(commentText)) !== null) {
      const whitespace = codegenMatch[1] || ""
      const codegenName = codegenMatch[2] || ""
      const codegenHash = codegenMatch[3] || ""
      const range: ts.TextRange = {
        pos: codegenMatch.index + pos + whitespace.length,
        end: codegenMatch.index + pos + codegenMatch[0].length
      }
      const codegen = codegens.find((codegen) => codegen.name === codegenName)
      if (!codegen) continue
      result.push({ codegen, hash: codegenHash, range })
    }
  }
  return result
})

export const getEditsForCodegen = Nano.fn("LSP.getEditsForCodegen")(function*(
  codegens: Array<CodegenDefinition>,
  sourceFile: ts.SourceFile,
  textRange: ts.TextRange
) {
  const applicableCodegens = yield* getCodegensForSourceFile(codegens, sourceFile)
  const inRangeCodegens = applicableCodegens.filter((codegen) =>
    codegen.range.pos <= textRange.pos && codegen.range.end >= textRange.end
  )
  if (inRangeCodegens.length !== 1) {
    return yield* Nano.fail(new CodegenNotApplicableError("zero or multiple codegens in range"))
  }
  const { codegen, range } = inRangeCodegens[0]
  const edit = yield* codegen.apply(sourceFile, range)
  const updateHashComment = pipe(
    Nano.service(TypeScriptApi.ChangeTracker),
    Nano.map((changeTracker) => {
      changeTracker.deleteRange(sourceFile, range)
      changeTracker.insertText(sourceFile, range.pos, `${codegen.name}:${edit.hash}`)
    })
  )
  return {
    ...edit,
    apply: pipe(
      edit.apply,
      Nano.flatMap(() => updateHashComment)
    ),
    ignore: updateHashComment
  } satisfies ApplicableCodegenDefinition & { ignore: Nano.Nano<void, never, ts.textChanges.ChangeTracker> }
})

export interface EffectLspPatchSourceFileMetadata {
  relationErrors: Array<[node: ts.Node, expectedType: ts.Type, valueNode: ts.Node, realType: ts.Type]>
}

export const getEffectLspPatchSourceFileMetadata = (
  sourceFile: ts.SourceFile
): EffectLspPatchSourceFileMetadata | undefined => {
  return (sourceFile as any)["@effect-lsp-patch/metadata"]
}

export const getOrDefaultEffectLspPatchSourceFileMetadata = (
  sourceFile: ts.SourceFile
): EffectLspPatchSourceFileMetadata => {
  return getEffectLspPatchSourceFileMetadata(sourceFile) ||
    ((sourceFile as any)["@effect-lsp-patch/metadata"] = {
      relationErrors: []
    })
}
