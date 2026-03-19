export const diagnosticGroups = [
  {
    id: "correctness",
    name: "Correctness",
    description: "Wrong, unsafe, or structurally invalid code patterns."
  },
  {
    id: "antipattern",
    name: "Anti-pattern",
    description: "Discouraged patterns that often lead to bugs or confusing behavior."
  },
  {
    id: "effectNative",
    name: "Effect-native",
    description: "Prefer Effect-native APIs and abstractions when available."
  },
  {
    id: "style",
    name: "Style",
    description: "Cleanup, consistency, and idiomatic Effect code."
  }
] as const

export type DiagnosticGroup = (typeof diagnosticGroups)[number]["id"]

export type DiagnosticGroupDefinition = (typeof diagnosticGroups)[number]

export const diagnosticGroupsById: Record<DiagnosticGroup, DiagnosticGroupDefinition> = Object.fromEntries(
  diagnosticGroups.map((group) => [group.id, group])
) as Record<DiagnosticGroup, DiagnosticGroupDefinition>
