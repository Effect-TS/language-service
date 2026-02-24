import * as Arr from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Terminal from "effect/Terminal"
import * as Prompt from "effect/unstable/cli/Prompt"
import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"
import type { DiagnosticInfo } from "./diagnostic-info"
import { cycleSeverity, getSeverityShortName, MAX_SEVERITY_LENGTH } from "./diagnostic-info"

import {
  ansi,
  BEEP,
  BG_BLACK_BRIGHT,
  BG_BLUE,
  BG_CYAN,
  BG_RED,
  BG_YELLOW,
  BOLD,
  CURSOR_HIDE,
  CURSOR_LEFT,
  CURSOR_TO_0,
  CYAN_BRIGHT,
  DIM,
  ERASE_LINE,
  GREEN,
  WHITE
} from "../ansi"

function eraseLines(count: number): string {
  let result = ""
  for (let i = 0; i < count; i++) {
    if (i > 0) result += "\x1b[1A" // cursor up
    result += ERASE_LINE
  }
  if (count > 0) result += CURSOR_LEFT
  return result
}

// ============================================================================
// Copied internals from @effect/cli (not exported)
// ============================================================================

const Action = Data.taggedEnum<Prompt.ActionDefinition>()

const NEWLINE_REGEX = /\r?\n/

function eraseText(text: string, columns: number): string {
  if (columns === 0) {
    return ERASE_LINE + CURSOR_TO_0
  }
  let rows = 0
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    rows += 1 + Math.floor(Math.max(line.length - 1, 0) / columns)
  }
  return eraseLines(rows)
}

function entriesToDisplay(
  cursor: number,
  total: number,
  maxVisible?: number
): { readonly startIndex: number; readonly endIndex: number } {
  const max = maxVisible === undefined ? total : maxVisible
  let startIndex = Math.min(total - max, cursor - Math.floor(max / 2))
  if (startIndex < 0) {
    startIndex = 0
  }
  const endIndex = Math.min(startIndex + max, total)
  return { startIndex, endIndex }
}

const defaultFigures = {
  arrowUp: "\u2191",
  arrowDown: "\u2193",
  tick: "\u2714",
  pointerSmall: "\u203A"
}

type Figures = typeof defaultFigures

const figuresValue: Figures = defaultFigures

// ============================================================================
// Diagnostic prompt types and state
// ============================================================================

interface State {
  readonly index: number
  readonly severities: Record<string, DiagnosticSeverity | "off">
}

interface DiagnosticPromptOptions {
  readonly message: string
  readonly diagnostics: ReadonlyArray<DiagnosticInfo>
  readonly maxPerPage: number
}

// ============================================================================
// Rendering functions (adapted from multi-select)
// ============================================================================

function getSeverityStyle(severity: DiagnosticSeverity | "off"): string {
  const styles = {
    off: WHITE + BG_BLACK_BRIGHT,
    suggestion: WHITE + BG_CYAN,
    message: WHITE + BG_BLUE,
    warning: WHITE + BG_YELLOW,
    error: WHITE + BG_RED
  }
  return styles[severity]
}

function renderOutput(
  leadingSymbol: string,
  trailingSymbol: string,
  options: DiagnosticPromptOptions
): string {
  const annotateLine = (line: string): string => ansi(line, BOLD)
  const prefix = leadingSymbol + " "
  return Arr.match(options.message.split(NEWLINE_REGEX), {
    onEmpty: () => `${prefix}${trailingSymbol}`,
    onNonEmpty: (promptLines) => {
      const lines = Arr.map(promptLines, (line) => annotateLine(line))
      return `${prefix}${lines.join("\n  ")} ${trailingSymbol} `
    }
  })
}

function renderDiagnostics(
  state: State,
  options: DiagnosticPromptOptions,
  figs: Figures,
  columns: number
) {
  const diagnostics = options.diagnostics
  const toDisplay = entriesToDisplay(state.index, diagnostics.length, options.maxPerPage)
  const documents: Array<string> = []

  for (let index = toDisplay.startIndex; index < toDisplay.endIndex; index++) {
    const diagnostic = diagnostics[index]
    const isHighlighted = state.index === index
    const currentSeverity = state.severities[diagnostic.name] ?? diagnostic.defaultSeverity
    const hasChanged = currentSeverity !== diagnostic.defaultSeverity

    // Arrow prefix for scroll indicators
    let prefix: string = " "
    if (index === toDisplay.startIndex && toDisplay.startIndex > 0) {
      prefix = figs.arrowUp
    } else if (index === toDisplay.endIndex - 1 && toDisplay.endIndex < diagnostics.length) {
      prefix = figs.arrowDown
    }

    // Severity badge with fixed width and background color
    const shortName = getSeverityShortName(currentSeverity)
    const paddedSeverity = shortName.padEnd(MAX_SEVERITY_LENGTH, " ")
    const severityStr = ansi(` ${paddedSeverity} `, getSeverityStyle(currentSeverity))

    // Diagnostic name with optional * for changed, highlight if selected
    const nameText = hasChanged ? `${diagnostic.name}*` : diagnostic.name
    const nameStr = isHighlighted
      ? ansi(nameText, CYAN_BRIGHT)
      : nameText

    const mainLine = `${prefix} ${severityStr} ${nameStr}`

    // Description - show on separate line below when highlighted
    if (isHighlighted && diagnostic.description) {
      // Indent to align with diagnostic name: prefix(1) + space(1) + severity badge(MAX_SEVERITY_LENGTH + 2) + space(1)
      const indentWidth = 1 + 1 + (MAX_SEVERITY_LENGTH + 2) + 1
      const indent = " ".repeat(indentWidth)
      // Truncate description to fit terminal width
      const availableWidth = columns - indentWidth
      const truncatedDescription = availableWidth > 0 && diagnostic.description.length > availableWidth
        ? diagnostic.description.substring(0, availableWidth - 1) + "\u2026"
        : diagnostic.description

      const descriptionStr = ansi(indent + truncatedDescription, DIM)

      documents.push(mainLine + "\n" + descriptionStr)
    } else {
      documents.push(mainLine)
    }
  }

  return documents.join("\n")
}

function renderNextFrame(state: State, options: DiagnosticPromptOptions) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const figs = figuresValue

    const diagnosticsStr = renderDiagnostics(state, options, figs, columns)
    const leadingSymbol = ansi("?", CYAN_BRIGHT)
    const trailingSymbol = figs.pointerSmall
    const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)

    const helpText = ansi(
      "Use \u2191/\u2193 to navigate, \u2190/\u2192 to change severity, Enter to finish",
      DIM
    )

    return CURSOR_HIDE + promptMsg + "\n" + helpText + "\n" + diagnosticsStr
  })
}

function renderSubmission(state: State, options: DiagnosticPromptOptions) {
  return Effect.gen(function*() {
    const figs = figuresValue

    const changedCount = Object.entries(state.severities).filter(([name, severity]) => {
      const diagnostic = options.diagnostics.find((d) => d.name === name)
      return diagnostic && severity !== diagnostic.defaultSeverity
    }).length

    const result = ansi(
      `${changedCount} diagnostic${changedCount === 1 ? "" : "s"} configured`,
      WHITE
    )

    const leadingSymbol = ansi(figs.tick, GREEN)
    const trailingSymbol = ""
    const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)

    return promptMsg + " " + result + "\n"
  })
}

// ============================================================================
// Input processing (adapted from multi-select)
// ============================================================================

function processCursorUp(state: State, totalCount: number) {
  const newIndex = state.index === 0 ? totalCount - 1 : state.index - 1
  return Effect.succeed(Action.NextFrame({ state: { ...state, index: newIndex } }))
}

function processCursorDown(state: State, totalCount: number) {
  const newIndex = (state.index + 1) % totalCount
  return Effect.succeed(Action.NextFrame({ state: { ...state, index: newIndex } }))
}

function processSeverityChange(
  state: State,
  options: DiagnosticPromptOptions,
  direction: "left" | "right"
) {
  const diagnostic = options.diagnostics[state.index]
  const currentSeverity = state.severities[diagnostic.name] ?? diagnostic.defaultSeverity
  const newSeverity = cycleSeverity(currentSeverity, direction)

  return Effect.succeed(Action.NextFrame({
    state: {
      ...state,
      severities: { ...state.severities, [diagnostic.name]: newSeverity }
    }
  }))
}

function handleProcess(options: DiagnosticPromptOptions) {
  return (input: Terminal.UserInput, state: State) => {
    const totalCount = options.diagnostics.length
    switch (input.key.name) {
      case "k":
      case "up": {
        return processCursorUp(state, totalCount)
      }
      case "j":
      case "down": {
        return processCursorDown(state, totalCount)
      }
      case "left": {
        return processSeverityChange(state, options, "left")
      }
      case "right": {
        return processSeverityChange(state, options, "right")
      }
      case "enter":
      case "return": {
        return Effect.succeed(Action.Submit({ value: state.severities }))
      }
      default: {
        return Effect.succeed(Action.Beep())
      }
    }
  }
}

// ============================================================================
// Clear and render handlers
// ============================================================================

function handleClear(options: DiagnosticPromptOptions) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const clearPrompt = ERASE_LINE + CURSOR_LEFT

    // Match Effect CLI pattern: "\n".repeat(visibleCount) + message
    // We have 2 extra lines (helpText + hardLine) compared to Effect CLI
    // PLUS 1 extra line for the description of the highlighted item (always shown)
    // So we need 2 extra newlines
    const visibleCount = Math.min(options.diagnostics.length, options.maxPerPage)
    const text = "\n".repeat(visibleCount + 2) + options.message
    const clearOutput = eraseText(text, columns)
    return clearOutput + clearPrompt
  })
}

function handleRender(options: DiagnosticPromptOptions) {
  return (
    state: State,
    action: Prompt.Action<State, Record<string, DiagnosticSeverity | "off">>
  ) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(BEEP),
      NextFrame: ({ state }) => renderNextFrame(state, options),
      Submit: () => renderSubmission(state, options)
    })
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create the custom diagnostic configuration prompt
 */
export function createDiagnosticPrompt(
  diagnostics: ReadonlyArray<DiagnosticInfo>,
  initialSeverities: Record<string, DiagnosticSeverity | "off">
): Prompt.Prompt<Record<string, DiagnosticSeverity | "off">> {
  const options: DiagnosticPromptOptions = {
    message: "Configure Diagnostic Severities",
    diagnostics,
    maxPerPage: 10
  }

  const initialState: State = {
    index: 0,
    severities: initialSeverities
  }

  return Prompt.custom(initialState, {
    render: handleRender(options),
    process: handleProcess(options),
    clear: () => handleClear(options)
  })
}
