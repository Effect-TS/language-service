import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ts from "typescript"
import { ansi, BOLD, CYAN, DIM, GREEN, RED, YELLOW } from "../ansi"
import type { Assessment } from "./assessment"
import type { ComputeChangesResult } from "./changes"
import { renderPlainTextFileChanges } from "./text-diff-renderer"

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
 * @param color - The ANSI color code to apply
 */
function renderLine(
  lineNum: number | undefined,
  symbol: "|" | "-" | "+",
  text: string,
  color: string
): string {
  const lineNumPart = lineNum !== undefined
    ? String(lineNum).padStart(4, " ")
    : "    "

  return ansi(`${lineNumPart} ${symbol} ${text}`, color)
}

/**
 * Render a single text change with context (1 line before and after)
 */
export function renderTextChange(
  sourceFile: ts.SourceFile,
  textChange: ts.TextChange
): ReadonlyArray<string> {
  const startPos = textChange.span.start
  const endPos = textChange.span.start + textChange.span.length

  const startLineAndChar = sourceFile.getLineAndCharacterOfPosition(startPos)
  const endLineAndChar = sourceFile.getLineAndCharacterOfPosition(endPos)

  const startLine = startLineAndChar.line
  const endLine = endLineAndChar.line
  const startCol = startLineAndChar.character
  const endCol = endLineAndChar.character

  const lines: Array<string> = []
  const allLines = getLines(sourceFile.text)

  // Show 1 line before the change (if exists)
  if (startLine > 0) {
    const contextBefore = allLines[startLine - 1]
    lines.push(renderLine(startLine, "|", contextBefore, DIM))
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
      lines.push(renderLine(startLine + 1, "|", keptBeforeDeletion, DIM))
    }

    // Show the deleted part of the first line
    const deletedOnFirstLine = startLine === endLine
      ? firstLineText.slice(startCol, endCol)
      : firstLineText.slice(startCol)

    if (deletedOnFirstLine.length > 0) {
      // Align with spaces to match the kept part's position
      const spacePadding = hasNonWhitespaceKept ? " ".repeat(keptBeforeDeletion.length) : ""
      lines.push(renderLine(undefined, "-", `${spacePadding}${deletedOnFirstLine}`, RED))
    }
  }

  // Show fully deleted lines (middle lines between start and end)
  for (let i = startLine + 1; i < endLine; i++) {
    const lineText = allLines[i]
    if (lineText !== undefined) {
      lines.push(renderLine(undefined, "-", lineText, RED))
    }
  }

  // Handle the last line of deletion (might be partial, and different from first line)
  if (endLine > startLine) {
    const lastLineText = allLines[endLine]
    const deletedOnLastLine = lastLineText.slice(0, endCol)

    if (deletedOnLastLine.length > 0) {
      lines.push(renderLine(undefined, "-", deletedOnLastLine, RED))
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
      lines.push(renderLine(undefined, "+", `${padding}${newLine}`, GREEN))
    }
  }

  // ============================================================================
  // Render kept part after deletion
  // ============================================================================

  // Calculate alignment for the kept part after deletion
  // If there's new text, align to the end of the last line of new text
  // Otherwise, align to the original position (endCol)
  let alignmentForKeptPart = 0

  if (textChange.newText.length > 0) {
    const newTextLines = textChange.newText.split("\n")
    const lastNewLine = newTextLines[newTextLines.length - 1]

    // If new text ends with a newline, or if there's only one line,
    // we need to consider the kept part before deletion
    if (lastNewLine.length === 0 && newTextLines.length > 1) {
      // New text ends with newline - no alignment needed
      alignmentForKeptPart = 0
    } else {
      // Calculate the length of the last line of new text
      const firstLineText = allLines[startLine]
      const keptBeforeDeletion = firstLineText.slice(0, startCol)
      const hasNonWhitespaceKept = keptBeforeDeletion.trim().length > 0

      if (hasNonWhitespaceKept) {
        // First line has kept part + new text
        if (newTextLines.length === 1) {
          // Single line new text - align to kept before + new text
          alignmentForKeptPart = keptBeforeDeletion.length + lastNewLine.length
        } else {
          // Multi-line new text - align to last line only
          alignmentForKeptPart = lastNewLine.length
        }
      } else {
        // No kept part before - align to new text length
        alignmentForKeptPart = lastNewLine.length
      }
    }
  } else {
    // No new text - align to original deletion position
    alignmentForKeptPart = endCol
  }

  if (endLine > startLine) {
    // Multi-line deletion: show the kept part after deletion on the last line
    const lastLineText = allLines[endLine]
    const keptAfterDeletion = lastLineText.slice(endCol)
    if (keptAfterDeletion.trim().length > 0) {
      const alignment = " ".repeat(alignmentForKeptPart)
      lines.push(renderLine(endLine + 1, "|", `${alignment}${keptAfterDeletion}`, DIM))
    }
  } else if (startLine === endLine) {
    // Single line case: show the kept part after deletion
    const firstLineText = allLines[startLine]
    const keptAfterDeletion = firstLineText.slice(endCol)
    if (keptAfterDeletion.trim().length > 0) {
      const alignment = " ".repeat(alignmentForKeptPart)
      lines.push(renderLine(startLine + 1, "|", `${alignment}${keptAfterDeletion}`, DIM))
    }
  }

  // Show 1 line after the change (if exists)
  if (endLine + 1 < allLines.length) {
    const contextAfter = allLines[endLine + 1]
    lines.push(renderLine(endLine + 2, "|", contextAfter, DIM))
  }

  return lines
}

/**
 * Render all text changes for a file
 */
export function renderFileChanges(
  sourceFile: ts.SourceFile,
  textChanges: ReadonlyArray<ts.TextChange>
): ReadonlyArray<string> {
  const lines: Array<string> = []

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
      lines.push("")
    }
  }

  return lines
}

/**
 * Render code actions with diffs
 */
export const renderCodeActions = (
  result: ComputeChangesResult,
  assessmentState: Assessment.State
): Effect.Effect<void> =>
  Effect.gen(function*() {
    // Check if there are no changes
    if (result.codeActions.length === 0) {
      yield* Console.log(ansi("No changes needed - your configuration is already up to date!", GREEN))
      return
    }

    // Collect all source files from assessment state (JSON files)
    const sourceFiles: Array<ts.SourceFile> = [
      assessmentState.packageJson.sourceFile,
      assessmentState.tsconfig.sourceFile
    ]
    if (Option.isSome(assessmentState.vscodeSettings)) {
      sourceFiles.push(assessmentState.vscodeSettings.value.sourceFile)
    }

    // Collect plain text files from assessment state (markdown files)
    const plainTextFiles: Array<{ path: string; text: string }> = []
    if (Option.isSome(assessmentState.agentsMd)) {
      plainTextFiles.push({
        path: assessmentState.agentsMd.value.path,
        text: assessmentState.agentsMd.value.text
      })
    }
    if (Option.isSome(assessmentState.claudeMd)) {
      plainTextFiles.push({
        path: assessmentState.claudeMd.value.path,
        text: assessmentState.claudeMd.value.text
      })
    }

    // Render each code action with diffs
    for (const codeAction of result.codeActions) {
      for (const fileChange of codeAction.changes) {
        // Find the source file that matches the file name
        const sourceFile = sourceFiles.find((sf) => sf.fileName === fileChange.fileName)
        const plainTextFile = plainTextFiles.find((pf) => pf.path === fileChange.fileName)

        // Render description and file name
        const header = [
          "",
          ansi(codeAction.description, BOLD),
          ansi(fileChange.fileName, CYAN),
          ""
        ].join("\n")
        yield* Console.log(header)

        if (sourceFile) {
          // Use source file for diff generation (JSON files)
          const diffLines = renderFileChanges(sourceFile, fileChange.textChanges)
          yield* Console.log(diffLines.join("\n"))
        } else if (plainTextFile) {
          // Use plain text renderer for diff generation (markdown files)
          const diffLines = renderPlainTextFileChanges(plainTextFile.text, fileChange.textChanges)
          yield* Console.log(diffLines.join("\n"))
        } else {
          // File not in assessment state, just mention we want to change it
          yield* Console.log("  (file will be modified)")
        }
      }
    }

    // Display user messages
    if (result.messages.length > 0) {
      yield* Console.log("")
      for (const message of result.messages) {
        const messageStr = message.includes("WARNING")
          ? ansi(message, YELLOW)
          : message

        yield* Console.log(messageStr)
      }
    }
  })
