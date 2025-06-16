import { isArray } from "effect/Array"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import { hasProperty, isBoolean, isObject, isRecord, isString } from "effect/Predicate"
import * as Nano from "./Nano"

export type DiagnosticSeverity = "error" | "warning" | "message" | "suggestion"

export interface LanguageServicePluginOptions {
  diagnostics: boolean
  diagnosticSeverity: Record<string, DiagnosticSeverity | "off">
  quickinfo: boolean
  completions: boolean
  goto: boolean
  allowedDuplicatedPackages: Array<string>
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

export function parse(config: any): LanguageServicePluginOptions {
  return {
    diagnostics: isObject(config) && hasProperty(config, "diagnostics") && isBoolean(config.diagnostics)
      ? config.diagnostics
      : true,
    diagnosticSeverity:
      isObject(config) && hasProperty(config, "diagnosticSeverity") && isRecord(config.diagnosticSeverity)
        ? parseDiagnosticSeverity(config.diagnosticSeverity)
        : {},
    quickinfo: isObject(config) && hasProperty(config, "quickinfo") && isBoolean(config.quickinfo)
      ? config.quickinfo
      : true,
    completions: isObject(config) && hasProperty(config, "completions") && isBoolean(config.completions)
      ? config.completions
      : true,
    goto: isObject(config) && hasProperty(config, "goto") && isBoolean(config.goto)
      ? config.goto
      : true,
    allowedDuplicatedPackages: isObject(config) && hasProperty(config, "allowedDuplicatedPackages") &&
        isArray(config.allowedDuplicatedPackages) && config.allowedDuplicatedPackages.every(isString)
      ? config.allowedDuplicatedPackages.map((_) => _.toLowerCase())
      : []
  }
}
