import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type JsonSchema,
  languageServicePluginAdditionalPropertiesJsonSchema
} from "../src/core/LanguageServicePluginOptions.js"
import { diagnostics } from "../src/diagnostics.js"

class ReadmeMarkersNotFoundError extends Error {
  constructor() {
    super("README diagnostics table markers not found")
  }
}

class DiagnosticsTableOutOfDateError extends Error {
  constructor() {
    super("README diagnostics table is out of date. Run `pnpm codegen`.")
  }
}

class SchemaGenerationPathError extends Error {
  constructor() {
    super("Could not locate compilerOptions.plugins in tsconfig base schema")
  }
}

class GeneratedSchemaOutOfDateError extends Error {
  constructor() {
    super("schema.json is out of date. Run `pnpm codegen`.")
  }
}

const startMarker = "<!-- diagnostics-table:start -->"
const endMarker = "<!-- diagnostics-table:end -->"
const scriptDir = fileURLToPath(new URL(".", import.meta.url))
const repoRoot = resolve(scriptDir, "../../..")
const readmePath = join(repoRoot, "README.md")
const generatedSchemaPath = join(repoRoot, "schema.json")
const baseSchemaPath = join(scriptDir, "tsconfig-base-schema.json")
const severityLevels = ["off", "error", "warning", "message", "suggestion"] as const

const severityIcon = {
  off: "➖",
  error: "❌",
  warning: "⚠️",
  message: "💬",
  suggestion: "💡"
} as const

const escapeTableCell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ")

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

const cloneSchema = <A>(schema: A): A => JSON.parse(JSON.stringify(schema)) as A

const effectPluginDiagnosticSeverityDefinitionName = "effectLanguageServicePluginDiagnosticSeverityDefinition"

const createDiagnosticSeveritySchema = (): JsonSchema => ({
  type: "object",
  description: "Allows overriding the default severity for each Effect diagnostic across the project.",
  additionalProperties: {
    type: "string",
    enum: severityLevels
  },
  properties: Object.fromEntries(
    diagnostics
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((diagnostic) => [
        diagnostic.name,
        {
          type: "string",
          enum: severityLevels,
          default: diagnostic.severity,
          description: `${diagnostic.description} Default severity: ${diagnostic.severity}.`
        } satisfies JsonSchema
      ])
  )
})

const createEffectPluginSchema = (): JsonSchema => ({
  type: "object",
  required: ["name"],
  properties: {
    name: {
      type: "string",
      enum: ["@effect/language-service"],
      description: "Plugin name."
    },
    ...languageServicePluginAdditionalPropertiesJsonSchema,
    diagnosticSeverity: {
      $ref: `#/definitions/${effectPluginDiagnosticSeverityDefinitionName}`
    }
  },
  additionalProperties: true
})

const createOtherPluginSchema = (schema: JsonSchema): JsonSchema => {
  const next = cloneSchema(schema)
  const nameSchema = next.properties?.name
  return {
    ...next,
    properties: {
      ...next.properties,
      name: {
        ...(nameSchema ?? { type: "string", description: "Plugin name." }),
        not: { enum: ["@effect/language-service"] }
      }
    }
  }
}

const renderSchema = (baseSchemaContent: string): string => {
  const schema = JSON.parse(baseSchemaContent) as {
    definitions?: Record<string, JsonSchema> & {
      compilerOptionsDefinition?: {
        properties?: {
          compilerOptions?: {
            properties?: {
              plugins?: JsonSchema
            }
          }
        }
      }
    }
  }
  const plugins = schema.definitions?.compilerOptionsDefinition?.properties?.compilerOptions?.properties?.plugins

  if (!plugins?.items) {
    throw new SchemaGenerationPathError()
  }

  schema.definitions ??= {}
  schema.definitions[effectPluginDiagnosticSeverityDefinitionName] = createDiagnosticSeveritySchema()

  const otherPluginSchema = createOtherPluginSchema(plugins.items)
  plugins.items = {
    anyOf: [
      createEffectPluginSchema(),
      otherPluginSchema
    ]
  }

  return `${JSON.stringify(schema, null, 2)}\n`
}

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined
    }
    throw error
  }
}

async function main() {
  const readme = await readFile(readmePath, "utf8")
  const startIndex = readme.indexOf(startMarker)
  const endIndex = readme.indexOf(endMarker)

  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    throw new ReadmeMarkersNotFoundError()
  }

  const block = `${startMarker}\n${renderTable()}\n${endMarker}`
  const updatedReadme = readme.slice(0, startIndex) + block + readme.slice(endIndex + endMarker.length)
  const baseSchema = await readFile(baseSchemaPath, "utf8")
  const updatedSchema = renderSchema(baseSchema)

  if (process.argv.includes("--check")) {
    if (updatedReadme !== readme) {
      throw new DiagnosticsTableOutOfDateError()
    }
    const existingSchema = await readIfExists(generatedSchemaPath)
    if (existingSchema !== updatedSchema) {
      throw new GeneratedSchemaOutOfDateError()
    }
    return
  }

  if (updatedReadme !== readme) {
    await writeFile(readmePath, updatedReadme)
  }
  if (updatedSchema !== await readIfExists(generatedSchemaPath)) {
    await writeFile(generatedSchemaPath, updatedSchema)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
