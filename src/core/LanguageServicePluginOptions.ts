import { isArray } from "effect/Array"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import { hasProperty, isBoolean, isNumber, isObject, isRecord, isString } from "effect/Predicate"
import * as Record from "effect/Record"
import * as Nano from "./Nano"

export type DiagnosticSeverity = "error" | "warning" | "message" | "suggestion"

export interface LanguageServicePluginOptions {
  refactors: boolean
  diagnostics: boolean
  diagnosticSeverity: Record<string, DiagnosticSeverity | "off">
  quickinfoEffectParameters: "always" | "never" | "whentruncated"
  quickinfo: boolean
  quickinfoMaximumLength: number
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
}

export const LanguageServicePluginOptions = Nano.Tag<LanguageServicePluginOptions>("PluginOptions")

function parseDiagnosticSeverity(config: Record<PropertyKey, unknown>): Record<string, DiagnosticSeverity | "off"> {
  if (!isRecord(config)) return {}
  return Object.fromEntries(
    pipe(
      Object.entries(config),
      Array.filter(([key, value]) => isString(key) && isString(value)),
      Array.map(([key, value]) => [String(key).toLowerCase(), String(value).toLowerCase()]),
      Array.filter(([_, value]) =>
        value === "off" || value === "error" || value === "warning" || value === "message" || value === "suggestion"
      )
    )
  )
}

export const defaults: LanguageServicePluginOptions = {
  refactors: true,
  diagnostics: true,
  diagnosticSeverity: {},
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
  noExternal: false
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
      isObject(config) && hasProperty(config, "diagnosticSeverity") && isRecord(config.diagnosticSeverity)
        ? parseDiagnosticSeverity(config.diagnosticSeverity)
        : defaults.diagnosticSeverity,
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
    importAliases: isObject(config) && hasProperty(config, "importAliases") && isRecord(config.importAliases)
      ? Record.map(config.importAliases, (value) => String(value))
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
      : defaults.noExternal
  }
}
