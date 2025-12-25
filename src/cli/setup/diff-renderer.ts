import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import type { Assessment } from "./assessment"
import type { ComputeChangesResult } from "./changes"

/**
 * Get lines from source file text
 */
function getLines(text: string): ReadonlyArray<string> {
  return text.split("\n")
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
export function renderTextChange(
  sourceFile: ts.SourceFile,
  textChange: ts.TextChange
): ReadonlyArray<Doc.AnsiDoc> {
  const startPos = textChange.span.start
  const endPos = textChange.span.start + textChange.span.length

  const startLineAndChar = sourceFile.getLineAndCharacterOfPosition(startPos)
  const endLineAndChar = sourceFile.getLineAndCharacterOfPosition(endPos)

  const startLine = startLineAndChar.line
  const endLine = endLineAndChar.line
  const startCol = startLineAndChar.character
  const endCol = endLineAndChar.character

  const lines: Array<Doc.AnsiDoc> = []
  const allLines = getLines(sourceFile.text)

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

    // Show the kept part after deletion (if it has non-whitespace)
    const keptAfterDeletion = lastLineText.slice(endCol)
    if (keptAfterDeletion.trim().length > 0) {
      lines.push(renderLine(endLine + 1, "|", keptAfterDeletion, Ansi.blackBright))
    }
  } else if (startLine === endLine) {
    // Single line case: show the kept part after deletion
    const firstLineText = allLines[startLine]
    const keptAfterDeletion = firstLineText.slice(endCol)
    if (keptAfterDeletion.trim().length > 0) {
      lines.push(renderLine(startLine + 1, "|", keptAfterDeletion, Ansi.blackBright))
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

  // Show 1 line after the change (if exists)
  if (endLine + 1 < allLines.length) {
    const contextAfter = allLines[endLine + 1]
    lines.push(renderLine(endLine + 2, "|", contextAfter, Ansi.blackBright))
  }

  return lines
}

/**
 * Render all text changes for a file
 */
export function renderFileChanges(
  sourceFile: ts.SourceFile,
  textChanges: ReadonlyArray<ts.TextChange>
): ReadonlyArray<Doc.AnsiDoc> {
  const lines: Array<Doc.AnsiDoc> = []

  // Sort changes by position
  const sortedChanges = [...textChanges].sort((a, b) => a.span.start - b.span.start)

  for (let i = 0; i < sortedChanges.length; i++) {
    const change = sortedChanges[i]
    const changeLines = renderTextChange(sourceFile, change)

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

/**
 * Render code actions with diffs using @effect/printer-ansi
 */
export const renderCodeActions = (
  result: ComputeChangesResult,
  assessmentState: Assessment.State
): Effect.Effect<void> =>
  Effect.gen(function*() {
    // Check if there are no changes
    if (result.codeActions.length === 0) {
      const noChanges = Doc.annotate(
        Doc.text("No changes needed - your configuration is already up to date!"),
        Ansi.green
      )
      const noChangesStr = noChanges.pipe(Doc.render({ style: "pretty" }))
      yield* Console.log(noChangesStr)
      return
    }

    // Collect all source files from assessment state
    const sourceFiles: Array<ts.SourceFile> = [
      assessmentState.packageJson.sourceFile,
      assessmentState.tsconfig.sourceFile
    ]
    if (Option.isSome(assessmentState.vscodeSettings)) {
      sourceFiles.push(assessmentState.vscodeSettings.value.sourceFile)
    }

    // Render each code action with diffs
    for (const codeAction of result.codeActions) {
      for (const fileChange of codeAction.changes) {
        // Find the source file that matches the file name
        const sourceFile = sourceFiles.find((sf) => sf.fileName === fileChange.fileName)

        // Render description and file name
        const header = Doc.vsep([
          Doc.empty,
          Doc.annotate(Doc.text(codeAction.description), Ansi.bold),
          Doc.annotate(Doc.text(fileChange.fileName), Ansi.cyan),
          Doc.empty
        ])
        const headerStr = header.pipe(Doc.render({ style: "pretty" }))
        yield* Console.log(headerStr)

        if (sourceFile) {
          // Use source file for diff generation
          const diffLines = renderFileChanges(sourceFile, fileChange.textChanges)
          const diff = Doc.vsep(diffLines)
          const diffStr = diff.pipe(Doc.render({ style: "pretty" }))
          yield* Console.log(diffStr)
        } else {
          // File not in assessment state, just mention we want to change it
          const noticeStr = Doc.text("  (file will be modified)").pipe(Doc.render({ style: "pretty" }))
          yield* Console.log(noticeStr)
        }
      }
    }

    // Display user messages
    if (result.messages.length > 0) {
      yield* Console.log("")
      for (const message of result.messages) {
        const messageDoc = message.includes("WARNING")
          ? Doc.annotate(Doc.text(message), Ansi.yellow)
          : Doc.text(message)

        const messageStr = messageDoc.pipe(Doc.render({ style: "pretty" }))
        yield* Console.log(messageStr)
      }
    }
  })
