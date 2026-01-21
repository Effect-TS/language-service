import * as Terminal from "@effect/platform/Terminal"
import * as Ansi from "@effect/printer-ansi/Ansi"
import * as Doc from "@effect/printer-ansi/AnsiDoc"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { dual } from "effect/Function"
import * as Option from "effect/Option"

/**
 * Options for the spinner
 */
export interface SpinnerOptions<A, E> {
  readonly message: string
  readonly frames?: ReadonlyArray<string>
  readonly onSuccess?: (value: A) => string
  readonly onFailure?: (error: E) => string
}

/**
 * Handle to update the spinner message while it's running
 */
export interface SpinnerHandle {
  readonly updateMessage: (message: string) => Effect.Effect<void>
}

// Full classic dots spinner sequence
const DEFAULT_FRAMES: ReadonlyArray<string> = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏"
]

// Figures for different platforms
const isWindows = typeof process !== "undefined" && process.platform === "win32"
const figures = {
  tick: isWindows ? "√" : "✔",
  cross: isWindows ? "×" : "✖"
}

// Small render helpers to reduce per-frame work.
const CLEAR_LINE = Doc.cat(Doc.eraseLine, Doc.cursorLeft)
const CURSOR_HIDE = Doc.render(Doc.cursorHide, { style: "pretty" })
const CURSOR_SHOW = Doc.render(Doc.cursorShow, { style: "pretty" })

const renderDoc = (columns: number, doc: Doc.AnsiDoc, addNewline = false): string => {
  const prepared = addNewline ? Doc.cat(doc, Doc.hardLine) : doc
  return Doc.render(prepared, { style: "pretty", options: { lineWidth: columns } })
}

/**
 * A spinner that renders while `effect` runs and prints ✔/✖ on completion.
 * Provides a handle to update the message while running.
 */
export const spinner: {
  <A, E, R>(
    options: SpinnerOptions<A, E>
  ): (effect: (handle: SpinnerHandle) => Effect.Effect<A, E, R>) => Effect.Effect<A, E, R | Terminal.Terminal>
  <A, E, R>(
    effect: (handle: SpinnerHandle) => Effect.Effect<A, E, R>,
    options: SpinnerOptions<A, E>
  ): Effect.Effect<A, E, R | Terminal.Terminal>
} = dual(
  2,
  <A, E, R>(
    effect: (handle: SpinnerHandle) => Effect.Effect<A, E, R>,
    options: SpinnerOptions<A, E>
  ): Effect.Effect<A, E, R | Terminal.Terminal> =>
    Effect.acquireUseRelease(
      // acquire
      Effect.gen(function*() {
        const terminal = yield* Terminal.Terminal

        // Hide cursor while active
        yield* Effect.orDie(terminal.display(CURSOR_HIDE))

        let index = 0
        let currentMessage = options.message

        const frames = options.frames ?? DEFAULT_FRAMES
        const frameCount = frames.length

        const displayDoc = (doc: Doc.AnsiDoc, addNewline = false) =>
          Effect.gen(function*() {
            const columns = yield* terminal.columns
            const out = renderDoc(columns, doc, addNewline)
            yield* Effect.orDie(terminal.display(out))
          })

        const renderFrame = Effect.gen(function*() {
          const i = index
          index = index + 1
          const spinnerDoc = Doc.annotate(Doc.text(frames[i % frameCount]!), Ansi.blue)
          const messageDoc = Doc.annotate(Doc.text(currentMessage), Ansi.bold)

          const line = Doc.hsep([spinnerDoc, messageDoc])
          yield* displayDoc(Doc.cat(CLEAR_LINE, line))
        })

        const computeFinalMessage = (exit: Exit.Exit<A, E>): string =>
          Exit.match(exit, {
            onFailure: (cause) => {
              let baseMessage = currentMessage
              if (options.onFailure) {
                const failureOption = Cause.failureOption(cause)
                if (Option.isSome(failureOption)) {
                  baseMessage = options.onFailure(failureOption.value)
                }
              }
              if (Cause.isInterrupted(cause)) {
                return `${baseMessage} (interrupted)`
              } else if (Cause.isDie(cause)) {
                return `${baseMessage} (died)`
              } else {
                return baseMessage
              }
            },
            onSuccess: (value) => options.onSuccess ? options.onSuccess(value) : currentMessage
          })

        const renderFinal = (exit: Exit.Exit<A, E>) =>
          Effect.gen(function*() {
            const icon = Exit.isSuccess(exit)
              ? Doc.annotate(Doc.text(figures.tick), Ansi.green)
              : Doc.annotate(Doc.text(figures.cross), Ansi.red)

            const finalMessage = computeFinalMessage(exit)

            const msgDoc = Doc.annotate(Doc.text(finalMessage), Ansi.bold)
            const line = Doc.hsep([icon, msgDoc])

            yield* displayDoc(Doc.cat(CLEAR_LINE, line), true)
          })

        const handle: SpinnerHandle = {
          updateMessage: (message: string) =>
            Effect.gen(function*() {
              currentMessage = message
              yield* renderFrame
            })
        }

        return {
          terminal,
          handle,
          renderFinal
        }
      }),
      // use
      ({ handle }) => effect(handle),
      // release
      ({ renderFinal, terminal }, exitValue) =>
        Effect.gen(function*() {
          // Signal the spinner fiber to finish by setting the exit.
          // (No external interrupt of the spinner fiber.)
          yield* renderFinal(exitValue)
        }).pipe(
          // Ensure cursor is shown even if something above failed.
          Effect.ensuring(Effect.orDie(terminal.display(CURSOR_SHOW)))
        )
    )
)
