import type { DiagnosticGroup } from "../../core/DiagnosticGroup"
import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"
import { diagnostics } from "../../diagnostics"
import metadataJson from "../../metadata.json"

export interface DiagnosticPreviewDiagnostic {
  readonly start: number
  readonly end: number
  readonly text: string
}

export interface DiagnosticPreview {
  readonly sourceText: string
  readonly diagnostics: ReadonlyArray<DiagnosticPreviewDiagnostic>
}

export interface DiagnosticGroupInfo {
  readonly id: DiagnosticGroup
  readonly name: string
  readonly description: string
}

export interface DiagnosticMetadataRule {
  readonly name: string
  readonly group: DiagnosticGroup
  readonly description: string
  readonly defaultSeverity: DiagnosticSeverity | "off"
  readonly fixable: boolean
  readonly supportedEffect: ReadonlyArray<"v3" | "v4">
  readonly preview: DiagnosticPreview
}

interface DiagnosticMetadata {
  readonly groups: ReadonlyArray<DiagnosticGroupInfo>
  readonly rules: ReadonlyArray<DiagnosticMetadataRule>
}

const diagnosticMetadata = metadataJson as unknown as DiagnosticMetadata

/**
 * Information about a diagnostic for display in the setup UI
 */
export interface DiagnosticInfo {
  readonly name: string
  readonly code: number
  readonly group: DiagnosticGroup
  readonly defaultSeverity: DiagnosticSeverity | "off"
  readonly description: string
  readonly preview: DiagnosticPreview
}

export function getDiagnosticGroups(): ReadonlyArray<DiagnosticGroupInfo> {
  return diagnosticMetadata.groups
}

export function getDiagnosticMetadataRules(): ReadonlyArray<DiagnosticMetadataRule> {
  return diagnosticMetadata.rules
}

/**
 * Get all available diagnostics with their metadata
 */
export function getAllDiagnostics(): ReadonlyArray<DiagnosticInfo> {
  const diagnosticsByName = new Map(diagnostics.map((diagnostic) => [diagnostic.name, diagnostic]))
  return getDiagnosticMetadataRules().flatMap((metadataRule) => {
    const diagnostic = diagnosticsByName.get(metadataRule.name)
    if (!diagnostic) {
      return []
    }
    return [{
      name: diagnostic.name,
      code: diagnostic.code,
      group: metadataRule.group,
      defaultSeverity: diagnostic.severity,
      description: metadataRule.description,
      preview: metadataRule.preview
    }]
  })
}

/**
 * Cycle to the next severity level
 */
export function cycleSeverity(
  current: DiagnosticSeverity | "off",
  direction: "left" | "right"
): DiagnosticSeverity | "off" {
  const order: ReadonlyArray<DiagnosticSeverity | "off"> = ["off", "suggestion", "message", "warning", "error"]
  const currentIndex = order.indexOf(current)

  if (direction === "right") {
    return order[(currentIndex + 1) % order.length]
  } else {
    return order[(currentIndex - 1 + order.length) % order.length]
  }
}

const shortNames = {
  off: "off",
  suggestion: "sugg",
  message: "info",
  warning: "warn",
  error: "err"
}

/**
 * Get the maximum length of severity text for fixed-width display
 */
export const MAX_SEVERITY_LENGTH = Object.values(shortNames).reduce((max, name) => Math.max(max, name.length), 0) // "warn" is the longest short name

/**
 * Get short display name for severity
 */
export function getSeverityShortName(severity: DiagnosticSeverity | "off"): string {
  return shortNames[severity] ?? "???"
}
