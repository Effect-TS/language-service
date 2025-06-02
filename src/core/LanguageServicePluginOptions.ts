import { hasProperty, isBoolean, isObject } from "effect/Predicate"
import * as Nano from "./Nano"

export interface LanguageServicePluginOptions {
  diagnostics: boolean
  quickinfo: boolean
  completions: boolean
  multipleEffectCheck: boolean
}

export const LanguageServicePluginOptions = Nano.Tag<LanguageServicePluginOptions>("PluginOptions")

export function parse(config: any): LanguageServicePluginOptions {
  return {
    diagnostics:
      isObject(config) && hasProperty(config, "diagnostics") && isBoolean(config.diagnostics)
        ? config.diagnostics
        : true,
    quickinfo: isObject(config) && hasProperty(config, "quickinfo") && isBoolean(config.quickinfo)
      ? config.quickinfo
      : true,
    completions:
      isObject(config) && hasProperty(config, "completions") && isBoolean(config.completions)
        ? config.completions
        : true,
    multipleEffectCheck: isObject(config) && hasProperty(config, "multipleEffectCheck") &&
        isBoolean(config.multipleEffectCheck)
      ? config.multipleEffectCheck
      : true
  }
}
