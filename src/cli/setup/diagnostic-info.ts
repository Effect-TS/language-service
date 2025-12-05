import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"
import { diagnostics } from "../../diagnostics"

/**
 * Information about a diagnostic for display in the setup UI
 */
export interface DiagnosticInfo {
  readonly name: string
  readonly code: number
  readonly defaultSeverity: DiagnosticSeverity | "off"
  readonly description: string
}

/**
 * Get all available diagnostics with their metadata
 */
export function getAllDiagnostics(): ReadonlyArray<DiagnosticInfo> {
  return diagnostics.map((diagnostic, index) => ({
    name: diagnostic.name,
    code: diagnostic.code,
    defaultSeverity: diagnostic.severity,
    // Use long descriptions to test word wrapping/truncation behavior
    description: index === 0
      ? "This is a very long description to test how the CLI handles descriptions that exceed the terminal width and should be truncated or wrapped appropriately without breaking the layout"
      : index === 1
      ? "Another extremely lengthy diagnostic description that contains multiple technical terms, code examples, and detailed explanations about what this diagnostic does and why it exists in the language service"
      : index === 2
      ? "Short description"
      : "Medium length description for testing various text lengths in the UI"
  }))
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
