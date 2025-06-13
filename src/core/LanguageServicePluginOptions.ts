import { isArray } from "effect/Array"
import { hasProperty, isBoolean, isObject, isString } from "effect/Predicate"
import * as Nano from "./Nano"

export interface LanguageServicePluginOptions {
  diagnostics: boolean
  quickinfo: boolean
  completions: boolean
  goto: boolean
  allowedDuplicatedPackages: Array<string>
}

export const LanguageServicePluginOptions = Nano.Tag<LanguageServicePluginOptions>("PluginOptions")

export function parse(config: any): LanguageServicePluginOptions {
  return {
    diagnostics: isObject(config) && hasProperty(config, "diagnostics") && isBoolean(config.diagnostics)
      ? config.diagnostics
      : true,
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
