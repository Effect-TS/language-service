import * as Prompt from "@effect/cli/Prompt"
import * as Terminal from "@effect/platform/Terminal"
import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import * as Arr from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"
import type { DiagnosticInfo } from "./diagnostic-info"
import { cycleSeverity, getSeverityShortName, MAX_SEVERITY_LENGTH } from "./diagnostic-info"

// ============================================================================
// Copied internals from @effect/cli (not exported)
// ============================================================================

const Action = Data.taggedEnum<Prompt.Prompt.ActionDefinition>()

const NEWLINE_REGEX = /\r?\n/

function eraseText(text: string, columns: number): Doc.AnsiDoc {
  if (columns === 0) {
    return Doc.cat(Doc.eraseLine, Doc.cursorTo(0))
  }
  let rows = 0
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    rows += 1 + Math.floor(Math.max(line.length - 1, 0) / columns)
  }
  return Doc.eraseLines(rows)
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
  arrowUp: Doc.text("↑"),
  arrowDown: Doc.text("↓"),
  tick: Doc.text("✔"),
  pointerSmall: Doc.text("›")
}

type Figures = typeof defaultFigures

const figures: Effect.Effect<Figures> = Effect.succeed(defaultFigures)

const renderBeep = Doc.render(Doc.beep, { style: "pretty" })

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

function getSeverityStyle(severity: DiagnosticSeverity | "off"): Ansi.Ansi {
  const styles = {
    off: Ansi.combine(Ansi.white, Ansi.bgBlackBright),
    suggestion: Ansi.combine(Ansi.white, Ansi.bgCyan),
    message: Ansi.combine(Ansi.white, Ansi.bgBlue),
    warning: Ansi.combine(Ansi.white, Ansi.bgYellow),
    error: Ansi.combine(Ansi.white, Ansi.bgRed)
  }
  return styles[severity]
}

function renderOutput(
  leadingSymbol: Doc.AnsiDoc,
  trailingSymbol: Doc.AnsiDoc,
  options: DiagnosticPromptOptions
) {
  const annotateLine = (line: string): Doc.AnsiDoc => Doc.annotate(Doc.text(line), Ansi.bold)
  const prefix = Doc.cat(leadingSymbol, Doc.space)
  return Arr.match(options.message.split(NEWLINE_REGEX), {
    onEmpty: () => Doc.hsep([prefix, trailingSymbol]),
    onNonEmpty: (promptLines) => {
      const lines = Arr.map(promptLines, (line) => annotateLine(line))
      return prefix.pipe(
        Doc.cat(Doc.nest(Doc.vsep(lines), 2)),
        Doc.cat(Doc.space),
        Doc.cat(trailingSymbol),
        Doc.cat(Doc.space)
      )
    }
  })
}

function renderDiagnostics(
  state: State,
  options: DiagnosticPromptOptions,
  figures: Figures,
  columns: number
) {
  const diagnostics = options.diagnostics
  const toDisplay = entriesToDisplay(state.index, diagnostics.length, options.maxPerPage)
  const documents: Array<Doc.AnsiDoc> = []

  for (let index = toDisplay.startIndex; index < toDisplay.endIndex; index++) {
    const diagnostic = diagnostics[index]
    const isHighlighted = state.index === index
    const currentSeverity = state.severities[diagnostic.name] ?? diagnostic.defaultSeverity
    const hasChanged = currentSeverity !== diagnostic.defaultSeverity

    // Arrow prefix for scroll indicators
    let prefix: Doc.AnsiDoc = Doc.space
    if (index === toDisplay.startIndex && toDisplay.startIndex > 0) {
      prefix = figures.arrowUp
    } else if (index === toDisplay.endIndex - 1 && toDisplay.endIndex < diagnostics.length) {
      prefix = figures.arrowDown
    }

    // Severity badge with fixed width and background color
    const shortName = getSeverityShortName(currentSeverity)
    const paddedSeverity = shortName.padEnd(MAX_SEVERITY_LENGTH, " ")
    const severityDoc = Doc.annotate(
      Doc.text(` ${paddedSeverity} `),
      getSeverityStyle(currentSeverity)
    )

    // Diagnostic name with optional * for changed, highlight if selected
    const nameText = hasChanged ? `${diagnostic.name}*` : diagnostic.name
    const nameDoc = isHighlighted
      ? Doc.annotate(Doc.text(nameText), Ansi.cyanBright)
      : Doc.text(nameText)

    const mainLine = prefix.pipe(
      Doc.cat(Doc.space),
      Doc.cat(severityDoc),
      Doc.cat(Doc.space),
      Doc.cat(nameDoc)
    )

    // Description - show on separate line below when highlighted
    if (isHighlighted && diagnostic.description) {
      // Indent to align with diagnostic name: prefix(1) + space(1) + severity badge(MAX_SEVERITY_LENGTH + 2) + space(1)
      const indentWidth = 1 + 1 + (MAX_SEVERITY_LENGTH + 2) + 1
      const indent = " ".repeat(indentWidth)
      // Truncate description to fit terminal width
      const availableWidth = columns - indentWidth
      const truncatedDescription = availableWidth > 0 && diagnostic.description.length > availableWidth
        ? diagnostic.description.substring(0, availableWidth - 1) + "…"
        : diagnostic.description

      const descriptionDoc = Doc.annotate(
        Doc.text(indent + truncatedDescription),
        Ansi.blackBright
      )

      documents.push(Doc.vsep([mainLine, descriptionDoc]))
    } else {
      documents.push(mainLine)
    }
  }

  return Doc.vsep(documents)
}

function renderNextFrame(state: State, options: DiagnosticPromptOptions) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const figs = yield* figures

    const diagnosticsDoc = renderDiagnostics(state, options, figs, columns)
    const leadingSymbol = Doc.annotate(Doc.text("?"), Ansi.cyanBright)
    const trailingSymbol = figs.pointerSmall
    const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)

    const helpText = Doc.annotate(
      Doc.text("Use ↑/↓ to navigate, ←/→ to change severity, Enter to finish"),
      Ansi.blackBright
    )

    return Doc.cursorHide.pipe(
      Doc.cat(promptMsg),
      Doc.cat(Doc.hardLine),
      Doc.cat(helpText),
      Doc.cat(Doc.hardLine),
      Doc.cat(diagnosticsDoc),
      Doc.render({ style: "pretty", options: { lineWidth: columns } })
    )
  })
}

function renderSubmission(state: State, options: DiagnosticPromptOptions) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = yield* terminal.columns
    const figs = yield* figures

    const changedCount = Object.entries(state.severities).filter(([name, severity]) => {
      const diagnostic = options.diagnostics.find((d) => d.name === name)
      return diagnostic && severity !== diagnostic.defaultSeverity
    }).length

    const result = Doc.annotate(
      Doc.text(`${changedCount} diagnostic${changedCount === 1 ? "" : "s"} configured`),
      Ansi.white
    )

    const leadingSymbol = Doc.annotate(figs.tick, Ansi.green)
    const trailingSymbol = Doc.text("")
    const promptMsg = renderOutput(leadingSymbol, trailingSymbol, options)

    return promptMsg.pipe(
      Doc.cat(Doc.space),
      Doc.cat(result),
      Doc.cat(Doc.hardLine),
      Doc.render({ style: "pretty", options: { lineWidth: columns } })
    )
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
    const clearPrompt = Doc.cat(Doc.eraseLine, Doc.cursorLeft)

    // Match Effect CLI pattern: "\n".repeat(visibleCount) + message
    // We have 2 extra lines (helpText + hardLine) compared to Effect CLI
    // PLUS 1 extra line for the description of the highlighted item (always shown)
    // So we need 2 extra newlines
    const visibleCount = Math.min(options.diagnostics.length, options.maxPerPage)
    const text = "\n".repeat(visibleCount + 2) + options.message
    const clearOutput = eraseText(text, columns)
    return clearOutput.pipe(
      Doc.cat(clearPrompt),
      Doc.render({ style: "pretty", options: { lineWidth: columns } })
    )
  })
}

function handleRender(options: DiagnosticPromptOptions) {
  return (
    state: State,
    action: Prompt.Prompt.Action<State, Record<string, DiagnosticSeverity | "off">>
  ) => {
    return Action.$match(action, {
      Beep: () => Effect.succeed(renderBeep),
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
