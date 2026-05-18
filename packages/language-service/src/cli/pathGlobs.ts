import * as Option from "effect/Option"
import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions"

export function parseGlobList(value: Option.Option<string>): Array<string> {
  if (Option.isNone(value)) return []
  return value.value
    .split(",")
    .map((glob) => glob.trim())
    .filter((glob) => glob.length > 0)
}

export function makeFileGlobSpec(filters: {
  include: Option.Option<string>
  exclude: Option.Option<string>
}): LanguageServicePluginOptions.LanguageServiceFileGlobSpec | undefined {
  const include = parseGlobList(filters.include)
  const exclude = parseGlobList(filters.exclude)
  if (include.length === 0 && exclude.length === 0) {
    return undefined
  }
  return LanguageServicePluginOptions.parseFileGlobSpec({
    include: include.length > 0 ? include : ["**/*"],
    exclude
  })
}
