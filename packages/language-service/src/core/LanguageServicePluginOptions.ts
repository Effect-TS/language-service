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
  effectFn: Array<"untraced" | "span" | "inferred-span" | "no-span">
  layerGraphFollowDepth: number
  mermaidProvider: "mermaid.com" | "mermaid.live" | ({} & string)
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
  pipeableMinArgCount: 2,
  effectFn: ["span"],
  layerGraphFollowDepth: 0,
  mermaidProvider: "mermaid.live"
}

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
        ? config.effectFn.map((_) => _.toLowerCase() as "untraced" | "span" | "inferred-span" | "no-span")
        : defaults.effectFn,
    layerGraphFollowDepth:
      isObject(config) && hasProperty(config, "layerGraphFollowDepth") && isNumber(config.layerGraphFollowDepth)
        ? config.layerGraphFollowDepth
        : defaults.layerGraphFollowDepth,
    mermaidProvider: isObject(config) && hasProperty(config, "mermaidProvider") &&
        isString(config.mermaidProvider)
      ? config.mermaidProvider
      : defaults.mermaidProvider
  }
}
