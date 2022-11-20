import type { DiagnosticDefinitionMessageCategory } from "@effect/language-service/diagnostics/definition"

export interface LanguageServicePluginConfig {
  diagnostic: Record<number, DiagnosticDefinitionMessageCategory>
}

type Decoder<A> = (value: unknown) => A

function literal<A extends Array<PropertyKey>>(...types: A) {
  return (def: A[number]): Decoder<A[number]> => (value) => types.indexOf(value as any) > -1 ? value as any : def
}

function record<A>(type: Decoder<A>): Decoder<Record<string, A>> {
  return (value: unknown) => {
    if (typeof value !== "object" || value === null) return {}
    return Object.keys(value).reduce((obj, key) => ({ ...obj, [key]: type(value[key]) }), {})
  }
}

function struct<A extends Record<string, Decoder<unknown>>>(types: A): Decoder<{ [K in keyof A]: ReturnType<A[K]> }> {
  return (value: unknown) => {
    return Object.keys(types).reduce(
      (obj, key) => ({ ...obj, [key]: types[key]!(typeof value !== "object" || value === null ? null : value[key]) }),
      {} as { [K in keyof A]: ReturnType<A[K]> }
    )
  }
}

export const parseLanguageServicePluginConfig = struct({
  diagnostics: record(literal("none", "suggestion", "warning", "error")("none"))
})
