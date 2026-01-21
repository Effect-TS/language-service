import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"

/**
 * A text change span (similar to ts.TextChange but for plain text)
 */
export interface TextChange {
  readonly span: { readonly start: number; readonly length: number }
  readonly newText: string
}

/**
 * Get lines from text by splitting on newlines
 */
function getLines(text: string): ReadonlyArray<string> {
  return text.split("\n")
}

/**
 * Get line and character position from a plain text string and offset
 */
function getLineAndCharacterOfPosition(
  text: string,
  position: number
): { line: number; character: number } {
  const lines = text.split("\n")
  let currentPos = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineLength = lines[lineIndex].length
    const lineEndPos = currentPos + lineLength

    if (position <= lineEndPos) {
      return { line: lineIndex, character: position - currentPos }
    }

    // +1 for the newline character
    currentPos = lineEndPos + 1
  }

  // Position is at or beyond end of text
  const lastLineIndex = lines.length - 1
  return { line: lastLineIndex, character: lines[lastLineIndex]?.length ?? 0 }
}

/**
 * Render a single line with consistent formatting
 * @param lineNum - Line number (1-based) or undefined for lines without numbers (changes)
 * @param symbol - Symbol to display: "|" for unchanged, "-" for deletion, "+" for addition
 * @param text - The actual line text
 * @param color - The ANSI color to apply
 */
function renderLine(
  lineNum: number | undefined,
  symbol: "|" | "-" | "+",
  text: string,
  color: Ansi.Ansi
): Doc.AnsiDoc {
  const lineNumPart = lineNum !== undefined
    ? String(lineNum).padStart(4, " ")
    : "    "

  return Doc.annotate(Doc.text(`${lineNumPart} ${symbol} ${text}`), color)
}

/**
 * Render a single text change with context (1 line before and after)
 */
export function renderPlainTextChange(
  text: string,
  textChange: TextChange
): ReadonlyArray<Doc.AnsiDoc> {
  const startPos = textChange.span.start
  const endPos = textChange.span.start + textChange.span.length

  const startLineAndChar = getLineAndCharacterOfPosition(text, startPos)
  const endLineAndChar = getLineAndCharacterOfPosition(text, endPos)

  const startLine = startLineAndChar.line
  const endLine = endLineAndChar.line
  const startCol = startLineAndChar.character
  const endCol = endLineAndChar.character

  const lines: Array<Doc.AnsiDoc> = []
  const allLines = getLines(text)

  // Show 1 line before the change (if exists)
  if (startLine > 0) {
    const contextBefore = allLines[startLine - 1]
    lines.push(renderLine(startLine, "|", contextBefore, Ansi.blackBright))
  }

  // ============================================================================
  // Render deleted text
  // ============================================================================

  // Handle the first line of deletion (might be partial)
  if (startLine <= endLine) {
    const firstLineText = allLines[startLine]
    const keptBeforeDeletion = firstLineText.slice(0, startCol)

    // Only show the kept part if it contains non-whitespace characters
    const hasNonWhitespaceKept = keptBeforeDeletion.trim().length > 0
    if (hasNonWhitespaceKept) {
      lines.push(renderLine(startLine + 1, "|", keptBeforeDeletion, Ansi.blackBright))
    }

    // Show the deleted part of the first line
    const deletedOnFirstLine = startLine === endLine
      ? firstLineText.slice(startCol, endCol)
      : firstLineText.slice(startCol)

    if (deletedOnFirstLine.length > 0) {
      // Align with spaces to match the kept part's position
      const spacePadding = hasNonWhitespaceKept ? " ".repeat(keptBeforeDeletion.length) : ""
      lines.push(renderLine(undefined, "-", `${spacePadding}${deletedOnFirstLine}`, Ansi.red))
    }
  }

  // Show fully deleted lines (middle lines between start and end)
  for (let i = startLine + 1; i < endLine; i++) {
    const lineText = allLines[i]
    if (lineText !== undefined) {
      lines.push(renderLine(undefined, "-", lineText, Ansi.red))
    }
  }

  // Handle the last line of deletion (might be partial, and different from first line)
  if (endLine > startLine) {
    const lastLineText = allLines[endLine]
    const deletedOnLastLine = lastLineText.slice(0, endCol)

    if (deletedOnLastLine.length > 0) {
      lines.push(renderLine(undefined, "-", deletedOnLastLine, Ansi.red))
    }
  }

  // ============================================================================
  // Render added text
  // ============================================================================

  if (textChange.newText.length > 0) {
    const newTextLines = textChange.newText.split("\n")

    // Determine if we should align the first line of additions
    const firstLineText = allLines[startLine]
    const keptBeforeDeletion = firstLineText.slice(0, startCol)
    const hasNonWhitespaceKept = keptBeforeDeletion.trim().length > 0
    const spacePadding = hasNonWhitespaceKept ? " ".repeat(keptBeforeDeletion.length) : ""

    for (let i = 0; i < newTextLines.length; i++) {
      const newLine = newTextLines[i]

      // Skip empty last line from split (trailing newline case)
      if (i === newTextLines.length - 1 && newLine.length === 0 && newTextLines.length > 1) {
        continue
      }

      // Align first line of addition with the kept part
      const padding = (i === 0 && hasNonWhitespaceKept) ? spacePadding : ""
      lines.push(renderLine(undefined, "+", `${padding}${newLine}`, Ansi.green))
    }
  }

  // ============================================================================
  // Render kept part after deletion
  // ============================================================================

  // Calculate alignment for the kept part after deletion
  let alignmentForKeptPart = 0

  if (textChange.newText.length > 0) {
    const newTextLines = textChange.newText.split("\n")
    const lastNewLine = newTextLines[newTextLines.length - 1]

    if (lastNewLine.length === 0 && newTextLines.length > 1) {
      // New text ends with newline - no alignment needed
      alignmentForKeptPart = 0
    } else {
      const firstLineText = allLines[startLine]
      const keptBeforeDeletion = firstLineText.slice(0, startCol)
      const hasNonWhitespaceKept = keptBeforeDeletion.trim().length > 0

      if (hasNonWhitespaceKept) {
        if (newTextLines.length === 1) {
          alignmentForKeptPart = keptBeforeDeletion.length + lastNewLine.length
        } else {
          alignmentForKeptPart = lastNewLine.length
        }
      } else {
        alignmentForKeptPart = lastNewLine.length
      }
    }
  } else {
    alignmentForKeptPart = endCol
  }

  if (endLine > startLine) {
    const lastLineText = allLines[endLine]
    const keptAfterDeletion = lastLineText.slice(endCol)
    if (keptAfterDeletion.trim().length > 0) {
      const alignment = " ".repeat(alignmentForKeptPart)
      lines.push(renderLine(endLine + 1, "|", `${alignment}${keptAfterDeletion}`, Ansi.blackBright))
    }
  } else if (startLine === endLine) {
    const firstLineText = allLines[startLine]
    const keptAfterDeletion = firstLineText.slice(endCol)
    if (keptAfterDeletion.trim().length > 0) {
      const alignment = " ".repeat(alignmentForKeptPart)
      lines.push(renderLine(startLine + 1, "|", `${alignment}${keptAfterDeletion}`, Ansi.blackBright))
    }
  }

  // Show 1 line after the change (if exists)
  if (endLine + 1 < allLines.length) {
    const contextAfter = allLines[endLine + 1]
    lines.push(renderLine(endLine + 2, "|", contextAfter, Ansi.blackBright))
  }

  return lines
}

/**
 * Render all text changes for a plain text file
 */
export function renderPlainTextFileChanges(
  text: string,
  textChanges: ReadonlyArray<TextChange>
): ReadonlyArray<Doc.AnsiDoc> {
  const lines: Array<Doc.AnsiDoc> = []

  // Sort changes by position
  const sortedChanges = [...textChanges].sort((a, b) => a.span.start - b.span.start)

  for (let i = 0; i < sortedChanges.length; i++) {
    const change = sortedChanges[i]
    const changeLines = renderPlainTextChange(text, change)

    // Add change lines to output
    for (const line of changeLines) {
      lines.push(line)
    }

    // Add separator between changes if there are multiple
    if (i < sortedChanges.length - 1) {
      lines.push(Doc.text(""))
    }
  }

  return lines
}
