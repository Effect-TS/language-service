import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { dual } from "effect/Function"
import * as Option from "effect/Option"
import * as Terminal from "effect/Terminal"
import { ansi, BLUE, BOLD, CURSOR_HIDE, CURSOR_LEFT, CURSOR_SHOW, ERASE_LINE, GREEN, RED } from "../ansi"

const CLEAR_LINE = ERASE_LINE + CURSOR_LEFT

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
  "\u280B",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283C",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280F"
]

// Figures for different platforms
const isWindows = typeof process !== "undefined" && process.platform === "win32"
const figures = {
  tick: isWindows ? "\u221A" : "\u2714",
  cross: isWindows ? "\u00D7" : "\u2716"
}

/**
 * A spinner that renders while `effect` runs and prints tick/cross on completion.
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

        const displayStr = (str: string) => Effect.orDie(terminal.display(str))

        const renderFrame = Effect.gen(function*() {
          const i = index
          index = index + 1
          const spinnerStr = ansi(frames[i % frameCount]!, BLUE)
          const messageStr = ansi(currentMessage, BOLD)
          const line = `${spinnerStr} ${messageStr}`
          yield* displayStr(CLEAR_LINE + line)
        })

        const computeFinalMessage = (exit: Exit.Exit<A, E>): string =>
          Exit.match(exit, {
            onFailure: (cause) => {
              let baseMessage = currentMessage
              if (options.onFailure) {
                const failureOption = Cause.findErrorOption(cause)
                if (Option.isSome(failureOption)) {
                  baseMessage = options.onFailure(failureOption.value)
                }
              }
              if (Cause.hasInterrupts(cause)) {
                return `${baseMessage} (interrupted)`
              } else if (Cause.hasDies(cause)) {
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
              ? ansi(figures.tick, GREEN)
              : ansi(figures.cross, RED)

            const finalMessage = computeFinalMessage(exit)
            const msgStr = ansi(finalMessage, BOLD)
            const line = `${icon} ${msgStr}`

            yield* displayStr(CLEAR_LINE + line + "\n")
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
        renderFinal(exitValue).pipe(
          // Ensure cursor is shown even if something above failed.
          Effect.ensuring(Effect.orDie(terminal.display(CURSOR_SHOW)))
        )
    )
)
