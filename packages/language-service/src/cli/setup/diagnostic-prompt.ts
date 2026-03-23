import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Terminal from "effect/Terminal"
import * as Prompt from "effect/unstable/cli/Prompt"
import type { DiagnosticGroup } from "../../core/DiagnosticGroup"
import type { DiagnosticSeverity } from "../../core/LanguageServicePluginOptions"
import {
  ansi,
  BEEP,
  BLUE,
  BOLD,
  CURSOR_HIDE,
  CURSOR_LEFT,
  CURSOR_TO_0,
  DIM,
  ERASE_LINE,
  ITALIC,
  RED,
  UNDERLINE,
  visibleLength,
  YELLOW
} from "../ansi"
import { cycleSeverity, type DiagnosticInfo, getDiagnosticGroups, getSeverityShortName } from "./diagnostic-info"

type RuleSeverity = DiagnosticSeverity | "off"

interface RuleEntry {
  readonly name: string
  readonly group: DiagnosticGroup
  readonly description: string
  readonly previewSourceText: string
  readonly previewDiagnostics: ReadonlyArray<{
    readonly start: number
    readonly end: number
    readonly text: string
  }>
  readonly defaultSeverity: RuleSeverity
}

interface HorizontalListState {
  readonly startIndex: number
  readonly searchText: string
  readonly severities: Readonly<Record<string, RuleSeverity>>
  readonly renderedColumns: number
  readonly renderedLines: ReadonlyArray<string>
}

interface VisibleEntries {
  readonly fullLine: string
  readonly visibleRules: ReadonlyArray<RuleEntry>
}

const diagnosticGroups = getDiagnosticGroups()
const Action = Data.taggedEnum<Prompt.ActionDefinition>()
const SEARCH_ICON = "/"
const MIN_PREVIEW_AND_MESSAGES_LINES = 18

interface HighlightRange {
  readonly start: number
  readonly end: number
}

interface WrappedPreviewLine {
  readonly text: string
  readonly start: number
  readonly end: number
}

function getControlsLegend(searchText: string): string {
  const searchLegend = searchText.length === 0
    ? `${SEARCH_ICON} type to search`
    : `${SEARCH_ICON} searching: ${searchText}`
  return `←/→ change rule  ↑/↓ change severity  ${searchLegend}`
}

function getSeveritySymbol(severity: RuleSeverity): string {
  const symbols: Record<RuleSeverity, string> = {
    off: ".",
    suggestion: "?",
    message: "i",
    warning: "!",
    error: "x"
  }
  return symbols[severity]
}

function getSeverityStyle(severity: RuleSeverity): string {
  const styles: Record<RuleSeverity, string> = {
    off: DIM,
    suggestion: DIM,
    message: BLUE,
    warning: YELLOW,
    error: RED
  }
  return styles[severity]
}

function renderEntry(entry: RuleEntry, severity: RuleSeverity, isSelected: boolean): string {
  const symbol = ansi(getSeveritySymbol(severity), getSeverityStyle(severity))
  const name = isSelected ? ansi(entry.name, UNDERLINE) : entry.name
  return `${symbol} ${name}`
}

function rowsForLength(length: number, columns: number): number {
  if (columns <= 0) {
    return 1
  }
  return Math.max(1, 1 + Math.floor(Math.max(length - 1, 0) / columns))
}

function eraseRenderedLines(lines: ReadonlyArray<string>, columns: number): string {
  let result = ""
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    const rows = rowsForLength(visibleLength(lines[lineIndex] ?? ""), columns)
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      result += ERASE_LINE
      if (!(lineIndex === 0 && rowIndex === rows - 1)) {
        result += "\x1b[1A"
      }
    }
  }
  if (lines.length > 0) {
    result += CURSOR_LEFT
  }
  return result
}

function wrapPaddedText(
  text: string,
  initialPadding: string,
  endPadding: string,
  columns: number
): ReadonlyArray<string> {
  if (text.length === 0) {
    return [initialPadding + endPadding]
  }

  const available = Math.max(columns - visibleLength(initialPadding) - visibleLength(endPadding), 1)
  const lines: Array<string> = []
  let remaining = text

  while (remaining.length > 0) {
    const chunk = remaining.slice(0, available)
    lines.push(initialPadding + chunk + endPadding)
    remaining = remaining.slice(chunk.length)
  }

  return lines
}

function wrapListItemText(
  text: string,
  firstLinePadding: string,
  continuationPadding: string,
  endPadding: string,
  columns: number
): ReadonlyArray<string> {
  if (text.length === 0) {
    return [firstLinePadding + endPadding]
  }

  const firstAvailable = Math.max(columns - visibleLength(firstLinePadding) - visibleLength(endPadding), 1)
  const continuationAvailable = Math.max(
    columns - visibleLength(continuationPadding) - visibleLength(endPadding),
    1
  )

  const lines: Array<string> = []
  let remaining = text
  let isFirstLine = true

  while (remaining.length > 0) {
    const padding = isFirstLine ? firstLinePadding : continuationPadding
    const available = isFirstLine ? firstAvailable : continuationAvailable
    const chunk = remaining.slice(0, available)
    lines.push(padding + chunk + endPadding)
    remaining = remaining.slice(chunk.length)
    isFirstLine = false
  }

  return lines
}

function renderPaddedLine(text: string, initialPadding: string, endPadding: string, columns: number): string {
  const available = Math.max(columns - visibleLength(initialPadding) - visibleLength(endPadding), 0)
  const truncated = visibleLength(text) <= available ? text : text.slice(0, available)
  const padding = Math.max(available - visibleLength(truncated), 0)
  return initialPadding + truncated + " ".repeat(padding) + endPadding
}

function mergeHighlightRanges(ranges: ReadonlyArray<HighlightRange>): ReadonlyArray<HighlightRange> {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .slice()
    .sort((a, b) => a.start - b.start)

  const merged: Array<HighlightRange> = []
  for (const range of sorted) {
    const previous = merged[merged.length - 1]
    if (!previous || range.start > previous.end) {
      merged.push(range)
      continue
    }
    merged[merged.length - 1] = {
      start: previous.start,
      end: Math.max(previous.end, range.end)
    }
  }
  return merged
}

function stylePreviewLine(
  line: string,
  lineStart: number,
  ranges: ReadonlyArray<HighlightRange>
): string {
  if (line.length === 0) {
    return ""
  }

  const lineEnd = lineStart + line.length
  let cursor = 0
  let rendered = ""

  for (const range of ranges) {
    const start = Math.max(range.start, lineStart)
    const end = Math.min(range.end, lineEnd)
    if (end <= start) {
      continue
    }

    const startIndex = start - lineStart
    const endIndex = end - lineStart

    if (cursor < startIndex) {
      rendered += ansi(line.slice(cursor, startIndex), DIM)
    }
    rendered += ansi(line.slice(startIndex, endIndex), UNDERLINE)
    cursor = endIndex
  }

  if (cursor < line.length) {
    rendered += ansi(line.slice(cursor), DIM)
  }

  return rendered
}

function wrapSourceLine(line: string, lineStart: number, availableWidth: number): ReadonlyArray<WrappedPreviewLine> {
  if (line.length === 0) {
    return [{ text: "", start: lineStart, end: lineStart }]
  }

  const width = Math.max(availableWidth, 1)
  const wrapped: Array<WrappedPreviewLine> = []
  let offset = 0

  while (offset < line.length) {
    const text = line.slice(offset, offset + width)
    wrapped.push({
      text,
      start: lineStart + offset,
      end: lineStart + offset + text.length
    })
    offset += text.length
  }

  return wrapped
}

function wrapPreviewSourceText(sourceText: string, columns: number): ReadonlyArray<WrappedPreviewLine> {
  const availableWidth = Math.max(columns - 2, 1)
  const logicalLines = sourceText.split("\n")
  const wrapped: Array<WrappedPreviewLine> = []
  let offset = 0

  for (const line of logicalLines) {
    for (const wrappedLine of wrapSourceLine(line, offset, availableWidth)) {
      wrapped.push(wrappedLine)
    }
    offset += line.length + 1
  }

  return wrapped
}

function renderPreviewSourceText(
  sourceText: string,
  diagnostics: RuleEntry["previewDiagnostics"],
  columns: number
): ReadonlyArray<string> {
  const ranges = mergeHighlightRanges(diagnostics.map((diagnostic) => ({
    start: diagnostic.start,
    end: diagnostic.end
  })))

  return wrapPreviewSourceText(sourceText, columns).map((line) => {
    const rendered = stylePreviewLine(line.text, line.start, ranges)
    return CURSOR_TO_0 + renderPaddedLine(rendered, "  ", "", columns)
  })
}

function renderPreviewMessages(
  diagnostics: RuleEntry["previewDiagnostics"],
  columns: number
): ReadonlyArray<string> {
  const messages = Array.from(new Set(diagnostics.map((diagnostic) => diagnostic.text)))
  return messages.flatMap((message) => {
    let isFirstBlock = true
    return message.split("\n").flatMap((line) => {
      const wrappedLines = wrapListItemText(line, isFirstBlock ? "- " : "  ", "  ", "", columns)
      isFirstBlock = false
      return wrappedLines.map((wrappedLine) => CURSOR_TO_0 + ansi(wrappedLine, DIM + ITALIC))
    })
  })
}

function renderDivider(columns: number, legendText?: string): string {
  if (legendText === undefined) {
    return ansi("─".repeat(Math.max(columns, 0)), DIM)
  }

  const legend = ` ${legendText} `
  const legendLength = visibleLength(legend)
  if (columns <= legendLength) {
    return ansi(legend.slice(0, Math.max(columns, 0)), DIM)
  }

  const remaining = columns - legendLength
  const left = "─".repeat(Math.floor(remaining / 2))
  const right = "─".repeat(remaining - left.length)
  return ansi(left + legend + right, DIM)
}

function renderSelectedRuleDivider(
  selected: RuleEntry | undefined,
  severities: Readonly<Record<string, RuleSeverity>>,
  columns: number
): string {
  if (!selected) {
    return renderDivider(columns)
  }

  const currentSeverity = severities[selected.name] ?? selected.defaultSeverity
  const text = `${selected.name} (currently set as ${getSeverityShortName(currentSeverity)})`
  return renderDivider(columns, text)
}

function matchesSearch(entry: RuleEntry, searchText: string): boolean {
  if (searchText.length === 0) {
    return true
  }
  const normalized = searchText.toLowerCase()
  return entry.name.toLowerCase().includes(normalized) ||
    entry.description.toLowerCase().includes(normalized) ||
    entry.previewSourceText.toLowerCase().includes(normalized)
}

function getFilteredEntries(entries: ReadonlyArray<RuleEntry>, searchText: string): ReadonlyArray<RuleEntry> {
  return entries.filter((entry) => matchesSearch(entry, searchText))
}

function normalizeStartIndex(length: number, startIndex: number): number {
  if (length <= 0) {
    return 0
  }
  return ((startIndex % length) + length) % length
}

function isPrintableInput(input: Terminal.UserInput): boolean {
  const printablePattern = new RegExp(String.raw`^[^\u0000-\u001F\u007F]+$`, "u")
  return (
    !input.key.ctrl &&
    !input.key.meta &&
    input.input.valueOrUndefined !== undefined &&
    printablePattern.test(input.input.valueOrUndefined)
  )
}

function buildVisibleEntries(
  entries: ReadonlyArray<RuleEntry>,
  severities: Readonly<Record<string, RuleSeverity>>,
  startIndex: number,
  columns: number
): VisibleEntries {
  if (entries.length === 0) {
    return {
      fullLine: renderPaddedLine(ansi("No matching rules", DIM), "  ", "  ", columns),
      visibleRules: []
    }
  }

  const reservedColumns = 4
  const itemColumns = Math.max(columns - reservedColumns, 0)
  const separator = "  "
  const visibleEntries: Array<string> = []
  const visibleRules: Array<RuleEntry> = []
  let currentLength = 0
  let seenCount = 0

  while (seenCount < entries.length) {
    const index = (startIndex + seenCount) % entries.length
    const rule = entries[index]!
    const currentSeverity = severities[rule.name] ?? rule.defaultSeverity
    const entry = renderEntry(rule, currentSeverity, seenCount === 0)
    const nextLength = visibleEntries.length === 0
      ? visibleLength(entry)
      : currentLength + separator.length + visibleLength(entry)

    if (nextLength > itemColumns) {
      break
    }

    visibleEntries.push(entry)
    visibleRules.push(rule)
    currentLength = nextLength
    seenCount++
  }

  const leftMarker = entries.length > 1 ? ansi("←", DIM) : " "
  const rightMarker = entries.length > 1 ? ansi("→", DIM) : " "
  return {
    fullLine: renderPaddedLine(visibleEntries.join(separator), `${leftMarker} `, ` ${rightMarker}`, columns),
    visibleRules
  }
}

function buildGroupLine(selected: RuleEntry | undefined, columns: number): string {
  if (!selected) {
    return renderPaddedLine("", "  ", "  ", columns)
  }

  const selectedIndex = diagnosticGroups.findIndex((group) => group.id === selected.group)
  const rotatedGroups = diagnosticGroups.map((_, index) =>
    diagnosticGroups[(selectedIndex + index) % diagnosticGroups.length]!
  )
  const content = rotatedGroups.map((group, index) => {
    const label = group.name.toUpperCase()
    return index === 0 ? ansi(label, BOLD) : ansi(label, DIM)
  }).join("  ")
  return renderPaddedLine(content, "  ", "  ", columns)
}

function buildFrame(
  entries: ReadonlyArray<RuleEntry>,
  searchText: string,
  severities: Readonly<Record<string, RuleSeverity>>,
  startIndex: number,
  columns: number
): ReadonlyArray<string> {
  const visible = buildVisibleEntries(entries, severities, startIndex, columns)
  const selected = visible.visibleRules[0]
  const wrappedDescription = wrapPaddedText(selected?.description ?? "", "  ", "", columns)
  const previewLines = renderPreviewSourceText(
    selected?.previewSourceText ?? "",
    selected?.previewDiagnostics ?? [],
    columns
  )
  const previewMessages = renderPreviewMessages(selected?.previewDiagnostics ?? [], columns)
  const previewSectionLines = [...previewLines, ...previewMessages]
  const paddingLines = Array.from(
    { length: Math.max(MIN_PREVIEW_AND_MESSAGES_LINES - previewSectionLines.length, 0) },
    () => ""
  )

  return [
    CURSOR_HIDE + renderSelectedRuleDivider(selected, severities, columns),
    ...previewSectionLines,
    ...paddingLines,
    CURSOR_TO_0 + renderDivider(columns),
    CURSOR_TO_0 + buildGroupLine(selected, columns),
    CURSOR_TO_0 + visible.fullLine,
    ...wrappedDescription.map((line) => CURSOR_TO_0 + ansi(line, DIM)),
    CURSOR_TO_0 + renderDivider(columns, getControlsLegend(searchText)),
    ""
  ]
}

function buildState(
  entries: ReadonlyArray<RuleEntry>,
  startIndex: number,
  searchText: string,
  severities: Readonly<Record<string, RuleSeverity>>
) {
  return Effect.gen(function*() {
    const terminal = yield* Terminal.Terminal
    const columns = Math.max(yield* terminal.columns, 1)
    const filteredEntries = getFilteredEntries(entries, searchText)
    const normalizedStartIndex = normalizeStartIndex(filteredEntries.length, startIndex)
    const renderedLines = buildFrame(filteredEntries, searchText, severities, normalizedStartIndex, columns)

    return {
      startIndex: normalizedStartIndex,
      searchText,
      severities,
      renderedColumns: columns,
      renderedLines
    } satisfies HorizontalListState
  })
}

function renderSubmission(state: HorizontalListState, entries: ReadonlyArray<RuleEntry>) {
  return Effect.succeed(
    CURSOR_TO_0 + JSON.stringify(
      Object.fromEntries(
        entries.flatMap((entry) => {
          const severity = state.severities[entry.name]
          return severity !== undefined && severity !== entry.defaultSeverity ? [[entry.name, severity]] : []
        })
      )
    ) + "\n"
  )
}

function handleProcess(entries: ReadonlyArray<RuleEntry>) {
  return (input: Terminal.UserInput, state: HorizontalListState) => {
    const filteredEntries = getFilteredEntries(entries, state.searchText)

    switch (input.key.name) {
      case "backspace":
        return buildState(entries, 0, state.searchText.slice(0, -1), state.severities).pipe(
          Effect.map((nextState) => Action.NextFrame({ state: nextState }))
        )
      case "left":
        if (filteredEntries.length === 0) return Effect.succeed(Action.Beep())
        return buildState(entries, state.startIndex - 1, state.searchText, state.severities).pipe(
          Effect.map((nextState) => Action.NextFrame({ state: nextState }))
        )
      case "right":
        if (filteredEntries.length === 0) return Effect.succeed(Action.Beep())
        return buildState(entries, state.startIndex + 1, state.searchText, state.severities).pipe(
          Effect.map((nextState) => Action.NextFrame({ state: nextState }))
        )
      case "up":
      case "down":
        if (filteredEntries.length === 0) return Effect.succeed(Action.Beep())
        return buildState(entries, state.startIndex, state.searchText, {
          ...state.severities,
          [filteredEntries[state.startIndex]!.name]: cycleSeverity(
            state.severities[filteredEntries[state.startIndex]!.name] ??
              filteredEntries[state.startIndex]!.defaultSeverity,
            input.key.name === "up" ? "left" : "right"
          )
        }).pipe(Effect.map((nextState) => Action.NextFrame({ state: nextState })))
      case "enter":
      case "return":
        return Effect.succeed(Action.Submit({
          value: Object.fromEntries(
            entries.flatMap((entry) => {
              const severity = state.severities[entry.name]
              return severity !== undefined && severity !== entry.defaultSeverity ? [[entry.name, severity]] : []
            })
          )
        }))
      default:
        if (!isPrintableInput(input)) return Effect.succeed(Action.Beep())
        return buildState(entries, 0, state.searchText + input.input, state.severities).pipe(
          Effect.map((nextState) => Action.NextFrame({ state: nextState }))
        )
    }
  }
}

function getPromptEntries(diagnostics: ReadonlyArray<DiagnosticInfo>): ReadonlyArray<RuleEntry> {
  const diagnosticsByName = new Map(diagnostics.map((diagnostic) => [diagnostic.name, diagnostic]))
  return diagnostics.flatMap((rule) => {
    const diagnostic = diagnosticsByName.get(rule.name)
    if (!diagnostic) {
      return []
    }
    return [{
      name: rule.name,
      group: diagnostic.group,
      description: diagnostic.description,
      previewSourceText: diagnostic.preview.sourceText,
      previewDiagnostics: diagnostic.preview.diagnostics,
      defaultSeverity: diagnostic.defaultSeverity
    }]
  })
}

export function createDiagnosticPrompt(
  diagnostics: ReadonlyArray<DiagnosticInfo>,
  initialSeverities: Record<string, DiagnosticSeverity | "off">
): Prompt.Prompt<Record<string, DiagnosticSeverity | "off">> {
  const entries = getPromptEntries(diagnostics)

  return Prompt.custom(buildState(entries, 0, "", initialSeverities), {
    render: (state, action) => {
      switch (action._tag) {
        case "Beep":
          return Effect.succeed(BEEP)
        case "NextFrame":
          return Effect.succeed((action.state as HorizontalListState).renderedLines.join("\n"))
        case "Submit":
          return renderSubmission(state as HorizontalListState, entries)
      }
    },
    process: handleProcess(entries),
    clear: (state) =>
      Effect.gen(function*() {
        const terminal = yield* Terminal.Terminal
        const columns = yield* terminal.columns
        return eraseRenderedLines((state as HorizontalListState).renderedLines, columns)
      })
  })
}
