import { isArray } from "effect/Array"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import { hasProperty, isBoolean, isNumber, isObject, isString } from "effect/Predicate"
import * as Record from "effect/Record"
import * as Nano from "./Nano"

export type DiagnosticSeverity = "error" | "warning" | "message" | "suggestion"

export type KeyBuilderKind = "service" | "error" | "custom"

export interface LanguageServicePluginOptionsKeyPattern {
  target: KeyBuilderKind
  pattern: "package-identifier" | "default" | "default-hashed"
  skipLeadingPath: Array<string>
}

export interface LanguageServicePluginOptions {
  refactors: boolean
  diagnostics: boolean
  diagnosticSeverity: Record<string, DiagnosticSeverity | "off">
  diagnosticsName: boolean
  missingDiagnosticNextLine: DiagnosticSeverity | "off"
  includeSuggestionsInTsc: boolean
  ignoreEffectWarningsInTscExitCode: boolean
  ignoreEffectErrorsInTscExitCode: boolean
  ignoreEffectSuggestionsInTscExitCode: boolean
  quickinfoEffectParameters: "always" | "never" | "whentruncated"
  quickinfo: boolean
  quickinfoMaximumLength: number
  keyPatterns: Array<LanguageServicePluginOptionsKeyPattern>
  extendedKeyDetection: boolean
  completions: boolean
  goto: boolean
  inlays: boolean
  allowedDuplicatedPackages: Array<string>
  namespaceImportPackages: Array<string>
  topLevelNamedReexports: "ignore" | "follow"
  barrelImportPackages: Array<string>
  importAliases: Record<string, string>
  renames: boolean
  noExternal: boolean
  pipeableMinArgCount: number
  effectFn: Array<"untraced" | "span" | "suggested-span" | "inferred-span" | "no-span">
  layerGraphFollowDepth: number
  mermaidProvider: "mermaid.com" | "mermaid.live" | ({} & string)
  skipDisabledOptimization: boolean
}

export interface JsonSchema {
  $ref?: string
  description?: string
  markdownDescription?: string
  type?: string | Array<string>
  default?: unknown
  enum?: ReadonlyArray<string | number | boolean>
  required?: Array<string>
  uniqueItems?: boolean
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  additionalProperties?: boolean | JsonSchema
  anyOf?: ReadonlyArray<JsonSchema>
  oneOf?: ReadonlyArray<JsonSchema>
  not?: JsonSchema
}

export const LanguageServicePluginOptions = Nano.Tag<LanguageServicePluginOptions>("PluginOptions")

function isValidSeverityLevel(value: string): value is DiagnosticSeverity | "off" {
  return value === "off" || value === "error" || value === "warning" || value === "message" || value === "suggestion"
}

function parseDiagnosticSeverity(config: Record<PropertyKey, unknown>): Record<string, DiagnosticSeverity | "off"> {
  if (!isObject(config)) return {}
  return Object.fromEntries(
    pipe(
      Object.entries(config),
      Array.filter(([key, value]) => isString(key) && isString(value)),
      Array.map(([key, value]) => [String(key).toLowerCase(), String(value).toLowerCase()]),
      Array.filter(([_, value]) => isValidSeverityLevel(value))
    )
  )
}

export const defaults: LanguageServicePluginOptions = {
  refactors: true,
  diagnostics: true,
  diagnosticSeverity: {},
  diagnosticsName: true,
  missingDiagnosticNextLine: "warning",
  includeSuggestionsInTsc: true,
  quickinfo: true,
  quickinfoEffectParameters: "whentruncated",
  quickinfoMaximumLength: -1,
  completions: true,
  goto: true,
  inlays: true,
  allowedDuplicatedPackages: [],
  namespaceImportPackages: [],
  topLevelNamedReexports: "ignore",
  barrelImportPackages: [],
  importAliases: {},
  renames: true,
  noExternal: false,
  keyPatterns: [{
    target: "service",
    pattern: "default",
    skipLeadingPath: ["src/"]
  }, {
    target: "custom",
    pattern: "default",
    skipLeadingPath: ["src/"]
  }],
  extendedKeyDetection: false,
  ignoreEffectWarningsInTscExitCode: false,
  ignoreEffectSuggestionsInTscExitCode: true,
  ignoreEffectErrorsInTscExitCode: false,
  pipeableMinArgCount: 2,
  effectFn: ["span"],
  layerGraphFollowDepth: 0,
  mermaidProvider: "mermaid.live",
  skipDisabledOptimization: false
}

const booleanSchema = (description: string, defaultValue: boolean): JsonSchema => ({
  type: "boolean",
  description,
  default: defaultValue
})

const stringArraySchema = (description: string, defaultValue: Array<string>): JsonSchema => ({
  type: "array",
  description,
  default: defaultValue,
  items: { type: "string" }
})

const stringEnumSchema = <A extends ReadonlyArray<string>>(
  description: string,
  values: A,
  defaultValue: A[number]
): JsonSchema => ({
  type: "string",
  description,
  enum: values,
  default: defaultValue
})

type LanguageServicePluginAdditionalProperty = Exclude<keyof LanguageServicePluginOptions, "diagnosticSeverity">

export const languageServicePluginAdditionalPropertiesJsonSchema = {
  refactors: booleanSchema("Controls Effect refactors.", defaults.refactors),
  diagnostics: booleanSchema("Controls Effect diagnostics.", defaults.diagnostics),
  diagnosticsName: booleanSchema(
    "Controls whether to include the rule name in diagnostic messages.",
    defaults.diagnosticsName
  ),
  missingDiagnosticNextLine: stringEnumSchema(
    "Controls the severity of warnings for unused @effect-diagnostics-next-line comments.",
    ["off", "error", "warning", "message", "suggestion"],
    defaults.missingDiagnosticNextLine
  ),
  includeSuggestionsInTsc: booleanSchema(
    "When patch mode is enabled, reports suggestion diagnostics as messages in TSC with a [suggestion] prefix.",
    defaults.includeSuggestionsInTsc
  ),
  ignoreEffectWarningsInTscExitCode: booleanSchema(
    "When enabled, Effect warnings do not affect the patched tsc exit code.",
    defaults.ignoreEffectWarningsInTscExitCode
  ),
  ignoreEffectErrorsInTscExitCode: booleanSchema(
    "When enabled, Effect errors do not affect the patched tsc exit code.",
    defaults.ignoreEffectErrorsInTscExitCode
  ),
  ignoreEffectSuggestionsInTscExitCode: booleanSchema(
    "When enabled, Effect suggestions do not affect the patched tsc exit code.",
    defaults.ignoreEffectSuggestionsInTscExitCode
  ),
  quickinfoEffectParameters: stringEnumSchema(
    "Controls when Effect quickinfo should include full type parameters.",
    ["always", "never", "whentruncated"],
    defaults.quickinfoEffectParameters
  ),
  quickinfo: booleanSchema("Controls Effect quickinfo.", defaults.quickinfo),
  quickinfoMaximumLength: {
    type: "number",
    description: "Controls the maximum quickinfo length. Use -1 to disable truncation.",
    default: defaults.quickinfoMaximumLength
  },
  keyPatterns: {
    type: "array",
    description: "Configures key patterns used for generated Effect service and error keys.",
    default: defaults.keyPatterns,
    items: {
      type: "object",
      properties: {
        target: stringEnumSchema("The key builder target.", ["service", "error", "custom"], "service"),
        pattern: stringEnumSchema(
          "The key generation pattern.",
          ["package-identifier", "default", "default-hashed"],
          "default"
        ),
        skipLeadingPath: stringArraySchema("Path prefixes to strip before generating keys.", ["src/"])
      }
    }
  },
  extendedKeyDetection: booleanSchema(
    "Enables extended heuristics when detecting key sources.",
    defaults.extendedKeyDetection
  ),
  completions: booleanSchema("Controls Effect completions.", defaults.completions),
  goto: booleanSchema("Controls Effect goto references support.", defaults.goto),
  inlays: booleanSchema("Controls Effect inlay hints.", defaults.inlays),
  allowedDuplicatedPackages: stringArraySchema(
    "Package names that are allowed to duplicate Effect as a peer dependency.",
    defaults.allowedDuplicatedPackages
  ),
  namespaceImportPackages: stringArraySchema(
    "Package names that should prefer namespace imports.",
    defaults.namespaceImportPackages
  ),
  topLevelNamedReexports: stringEnumSchema(
    "For namespaceImportPackages, controls how top-level named re-exports are handled.",
    ["ignore", "follow"],
    defaults.topLevelNamedReexports
  ),
  barrelImportPackages: stringArraySchema(
    "Package names that should prefer imports from their top-level barrel file.",
    defaults.barrelImportPackages
  ),
  importAliases: {
    type: "object",
    description: "Custom aliases to use for imported identifiers.",
    default: defaults.importAliases,
    additionalProperties: {
      type: "string"
    }
  },
  renames: booleanSchema("Controls Effect rename helpers.", defaults.renames),
  noExternal: booleanSchema(
    "Disables features that link to external websites.",
    defaults.noExternal
  ),
  pipeableMinArgCount: {
    type: "number",
    description: "Minimum argument count required before pipeable suggestions are emitted.",
    default: defaults.pipeableMinArgCount
  },
  effectFn: {
    type: "array",
    description: "Configures which Effect.fn variants should be suggested.",
    default: defaults.effectFn,
    items: {
      type: "string",
      enum: ["untraced", "span", "suggested-span", "inferred-span", "no-span"]
    }
  },
  layerGraphFollowDepth: {
    type: "number",
    description: "Controls how deeply layer graph analysis follows dependencies.",
    default: defaults.layerGraphFollowDepth
  },
  mermaidProvider: {
    type: "string",
    description: "Controls which Mermaid renderer is used for layer graphs.",
    default: defaults.mermaidProvider
  },
  skipDisabledOptimization: booleanSchema(
    "When enabled, disabled diagnostics are still processed so comment-based overrides can be honored.",
    defaults.skipDisabledOptimization
  )
} satisfies Record<LanguageServicePluginAdditionalProperty, JsonSchema>

function parseKeyPatterns(patterns: Array<unknown>): Array<LanguageServicePluginOptionsKeyPattern> {
  const result: Array<LanguageServicePluginOptionsKeyPattern> = []
  for (const entry of patterns) {
    if (!isObject(entry)) continue
    result.push({
      target: hasProperty(entry, "target") && isString(entry.target) &&
          ["service", "error", "custom"].includes(entry.target.toLowerCase())
        ? entry.target.toLowerCase() as LanguageServicePluginOptionsKeyPattern["target"]
        : "service",
      pattern: hasProperty(entry, "pattern") && isString(entry.pattern) &&
          ["package-identifier", "default", "default-hashed"].includes(entry.pattern.toLowerCase())
        ? entry.pattern.toLowerCase() as LanguageServicePluginOptionsKeyPattern["pattern"]
        : "default",
      skipLeadingPath:
        hasProperty(entry, "skipLeadingPath") && isArray(entry.skipLeadingPath) && entry.skipLeadingPath.every(isString)
          ? entry.skipLeadingPath
          : ["src/"]
    })
  }
  return result
}

export function parse(config: any): LanguageServicePluginOptions {
  return {
    refactors: isObject(config) && hasProperty(config, "refactors") && isBoolean(config.refactors)
      ? config.refactors
      : defaults.refactors,
    diagnostics: isObject(config) && hasProperty(config, "diagnostics") && isBoolean(config.diagnostics)
      ? config.diagnostics
      : defaults.diagnostics,
    diagnosticSeverity:
      isObject(config) && hasProperty(config, "diagnosticSeverity") && isObject(config.diagnosticSeverity)
        ? parseDiagnosticSeverity(config.diagnosticSeverity as Record<PropertyKey, unknown>)
        : defaults.diagnosticSeverity,
    diagnosticsName: isObject(config) && hasProperty(config, "diagnosticsName") && isBoolean(config.diagnosticsName)
      ? config.diagnosticsName
      : defaults.diagnosticsName,
    missingDiagnosticNextLine: isObject(config) && hasProperty(config, "missingDiagnosticNextLine") &&
        isString(config.missingDiagnosticNextLine) && isValidSeverityLevel(config.missingDiagnosticNextLine)
      ? config.missingDiagnosticNextLine as DiagnosticSeverity | "off"
      : defaults.missingDiagnosticNextLine,
    includeSuggestionsInTsc: isObject(config) && hasProperty(config, "includeSuggestionsInTsc") &&
        isBoolean(config.includeSuggestionsInTsc)
      ? config.includeSuggestionsInTsc
      : defaults.includeSuggestionsInTsc,
    ignoreEffectWarningsInTscExitCode: isObject(config) && hasProperty(config, "ignoreEffectWarningsInTscExitCode") &&
        isBoolean(config.ignoreEffectWarningsInTscExitCode)
      ? config.ignoreEffectWarningsInTscExitCode
      : defaults.ignoreEffectWarningsInTscExitCode,
    ignoreEffectSuggestionsInTscExitCode:
      isObject(config) && hasProperty(config, "ignoreEffectSuggestionsInTscExitCode") &&
        isBoolean(config.ignoreEffectSuggestionsInTscExitCode)
        ? config.ignoreEffectSuggestionsInTscExitCode
        : defaults.ignoreEffectSuggestionsInTscExitCode,
    ignoreEffectErrorsInTscExitCode: isObject(config) && hasProperty(config, "ignoreEffectErrorsInTscExitCode") &&
        isBoolean(config.ignoreEffectErrorsInTscExitCode)
      ? config.ignoreEffectErrorsInTscExitCode
      : defaults.ignoreEffectErrorsInTscExitCode,
    quickinfo: isObject(config) && hasProperty(config, "quickinfo") && isBoolean(config.quickinfo)
      ? config.quickinfo
      : defaults.quickinfo,
    quickinfoEffectParameters: isObject(config) && hasProperty(config, "quickinfoEffectParameters") &&
        isString(config.quickinfoEffectParameters) &&
        ["always", "never", "whentruncated"].includes(config.quickinfoEffectParameters.toLowerCase())
      ? config.quickinfoEffectParameters.toLowerCase() as "always" | "never" | "whentruncated"
      : defaults.quickinfoEffectParameters,
    quickinfoMaximumLength:
      isObject(config) && hasProperty(config, "quickinfoMaximumLength") && isNumber(config.quickinfoMaximumLength)
        ? config.quickinfoMaximumLength
        : defaults.quickinfoMaximumLength,
    completions: isObject(config) && hasProperty(config, "completions") && isBoolean(config.completions)
      ? config.completions
      : defaults.completions,
    goto: isObject(config) && hasProperty(config, "goto") && isBoolean(config.goto)
      ? config.goto
      : defaults.goto,
    inlays: isObject(config) && hasProperty(config, "inlays") && isBoolean(config.inlays)
      ? config.inlays
      : defaults.inlays,
    allowedDuplicatedPackages: isObject(config) && hasProperty(config, "allowedDuplicatedPackages") &&
        isArray(config.allowedDuplicatedPackages) && config.allowedDuplicatedPackages.every(isString)
      ? config.allowedDuplicatedPackages.map((_) => _.toLowerCase())
      : defaults.allowedDuplicatedPackages,
    namespaceImportPackages: isObject(config) && hasProperty(config, "namespaceImportPackages") &&
        isArray(config.namespaceImportPackages) && config.namespaceImportPackages.every(isString)
      ? config.namespaceImportPackages.map((_) => _.toLowerCase())
      : defaults.namespaceImportPackages,
    barrelImportPackages: isObject(config) && hasProperty(config, "barrelImportPackages") &&
        isArray(config.barrelImportPackages) && config.barrelImportPackages.every(isString)
      ? config.barrelImportPackages.map((_) => _.toLowerCase())
      : defaults.barrelImportPackages,
    importAliases: isObject(config) && hasProperty(config, "importAliases") && isObject(config.importAliases)
      ? Record.map(config.importAliases as Record<string, unknown>, (value) => String(value))
      : defaults.importAliases,
    topLevelNamedReexports: isObject(config) && hasProperty(config, "topLevelNamedReexports") &&
        isString(config.topLevelNamedReexports) &&
        ["ignore", "follow"].includes(config.topLevelNamedReexports.toLowerCase())
      ? config.topLevelNamedReexports.toLowerCase() as "ignore" | "follow"
      : defaults.topLevelNamedReexports,
    renames: isObject(config) && hasProperty(config, "renames") && isBoolean(config.renames)
      ? config.renames
      : defaults.renames,
    noExternal: isObject(config) && hasProperty(config, "noExternal") && isBoolean(config.noExternal)
      ? config.noExternal
      : defaults.noExternal,
    keyPatterns: isObject(config) && hasProperty(config, "keyPatterns") && isArray(config.keyPatterns)
      ? parseKeyPatterns(config.keyPatterns)
      : defaults.keyPatterns,
    extendedKeyDetection:
      isObject(config) && hasProperty(config, "extendedKeyDetection") && isBoolean(config.extendedKeyDetection)
        ? config.extendedKeyDetection
        : defaults.extendedKeyDetection,
    pipeableMinArgCount:
      isObject(config) && hasProperty(config, "pipeableMinArgCount") && isNumber(config.pipeableMinArgCount)
        ? config.pipeableMinArgCount
        : defaults.pipeableMinArgCount,
    effectFn:
      isObject(config) && hasProperty(config, "effectFn") && isArray(config.effectFn) && config.effectFn.every(isString)
        ? config.effectFn.map((_) =>
          _.toLowerCase() as "untraced" | "span" | "inferred-span" | "suggested-span" | "no-span"
        )
        : defaults.effectFn,
    layerGraphFollowDepth:
      isObject(config) && hasProperty(config, "layerGraphFollowDepth") && isNumber(config.layerGraphFollowDepth)
        ? config.layerGraphFollowDepth
        : defaults.layerGraphFollowDepth,
    mermaidProvider: isObject(config) && hasProperty(config, "mermaidProvider") &&
        isString(config.mermaidProvider)
      ? config.mermaidProvider
      : defaults.mermaidProvider,
    skipDisabledOptimization: isObject(config) && hasProperty(config, "skipDisabledOptimization") &&
        isBoolean(config.skipDisabledOptimization)
      ? config.skipDisabledOptimization
      : defaults.skipDisabledOptimization
  }
}
