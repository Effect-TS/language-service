import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FileSystem from "effect/FileSystem"
import { pipe } from "effect/Function"
import * as Path from "effect/Path"
import { fileURLToPath } from "node:url"
import { diagnostics } from "../src/diagnostics.js"

class ReadmeMarkersNotFoundError extends Data.TaggedError("ReadmeMarkersNotFoundError")<{}> {
  get message(): string {
    return "README diagnostics table markers not found"
  }
}

class DiagnosticsTableOutOfDateError extends Data.TaggedError("DiagnosticsTableOutOfDateError")<{}> {
  get message(): string {
    return "README diagnostics table is out of date. Run `pnpm codegen`."
  }
}

const startMarker = "<!-- diagnostics-table:start -->"
const endMarker = "<!-- diagnostics-table:end -->"
const scriptDir = fileURLToPath(new URL(".", import.meta.url))

const severityIcon = {
  off: "➖",
  error: "❌",
  warning: "⚠️",
  message: "💬",
  suggestion: "💡"
} as const

const escapeTableCell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ")

const renderTable = () =>
  [
    "| Diagnostic | Sev | Fix | Description | v3 | v4 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...diagnostics
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((diagnostic) =>
      `| \`${diagnostic.name}\` | ${severityIcon[diagnostic.severity]} | ${diagnostic.fixable ? "🔧" : ""} | ${
        escapeTableCell(diagnostic.description)
      } | ${diagnostic.supportedEffect.includes("v3") ? "✓" : ""} | ${
        diagnostic.supportedEffect.includes("v4") ? "✓" : ""
      } |`
      ),
    "",
    "`➖` off by default, `❌` error, `⚠️` warning, `💬` message, `💡` suggestion, `🔧` quick fix available"
  ].join("\n")

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const repoRoot = path.resolve(scriptDir, "../../..")
  const readmePath = path.join(repoRoot, "README.md")
  const readme = yield* fs.readFileString(readmePath)
  const startIndex = readme.indexOf(startMarker)
  const endIndex = readme.indexOf(endMarker)

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return yield* new ReadmeMarkersNotFoundError()
  }

  const block = `${startMarker}\n${renderTable()}\n${endMarker}`
  const updatedReadme = readme.slice(0, startIndex) + block + readme.slice(endIndex + endMarker.length)

  if (process.argv.includes("--check")) {
    if (updatedReadme !== readme) {
      return yield* new DiagnosticsTableOutOfDateError()
    }
    return
  }

  if (updatedReadme !== readme) {
    yield* fs.writeFileString(readmePath, updatedReadme)
  }
})

pipe(program, Effect.provide(NodeServices.layer), Effect.runPromiseExit).then((exit) => {
  if (Exit.isFailure(exit)) {
    console.error(Cause.pretty(exit.cause))
    process.exit(1)
  }
})
