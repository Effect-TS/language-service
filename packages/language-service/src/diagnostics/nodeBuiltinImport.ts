import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"

const moduleAlternativesV3 = new Map<string, { alternative: string; module: string; package: string }>([
  ["fs", { alternative: "FileSystem", module: "fs", package: "@effect/platform" }],
  ["node:fs", { alternative: "FileSystem", module: "fs", package: "@effect/platform" }],
  ["fs/promises", { alternative: "FileSystem", module: "fs", package: "@effect/platform" }],
  ["node:fs/promises", { alternative: "FileSystem", module: "fs", package: "@effect/platform" }],
  ["path", { alternative: "Path", module: "path", package: "@effect/platform" }],
  ["node:path", { alternative: "Path", module: "path", package: "@effect/platform" }],
  ["path/posix", { alternative: "Path", module: "path", package: "@effect/platform" }],
  ["node:path/posix", { alternative: "Path", module: "path", package: "@effect/platform" }],
  ["path/win32", { alternative: "Path", module: "path", package: "@effect/platform" }],
  ["node:path/win32", { alternative: "Path", module: "path", package: "@effect/platform" }],
  ["child_process", { alternative: "CommandExecutor", module: "child_process", package: "@effect/platform" }],
  ["node:child_process", { alternative: "CommandExecutor", module: "child_process", package: "@effect/platform" }],
  ["http", { alternative: "HttpClient", module: "http", package: "@effect/platform" }],
  ["node:http", { alternative: "HttpClient", module: "http", package: "@effect/platform" }],
  ["https", { alternative: "HttpClient", module: "https", package: "@effect/platform" }],
  ["node:https", { alternative: "HttpClient", module: "https", package: "@effect/platform" }]
])

const moduleAlternativesV4 = new Map<string, { alternative: string; module: string; package: string }>([
  ["fs", { alternative: "FileSystem", module: "fs", package: "effect" }],
  ["node:fs", { alternative: "FileSystem", module: "fs", package: "effect" }],
  ["fs/promises", { alternative: "FileSystem", module: "fs", package: "effect" }],
  ["node:fs/promises", { alternative: "FileSystem", module: "fs", package: "effect" }],
  ["path", { alternative: "Path", module: "path", package: "effect" }],
  ["node:path", { alternative: "Path", module: "path", package: "effect" }],
  ["path/posix", { alternative: "Path", module: "path", package: "effect" }],
  ["node:path/posix", { alternative: "Path", module: "path", package: "effect" }],
  ["path/win32", { alternative: "Path", module: "path", package: "effect" }],
  ["node:path/win32", { alternative: "Path", module: "path", package: "effect" }],
  ["child_process", { alternative: "ChildProcess", module: "child_process", package: "effect" }],
  ["node:child_process", { alternative: "ChildProcess", module: "child_process", package: "effect" }],
  ["http", { alternative: "HttpClient", module: "http", package: "effect/unstable/http" }],
  ["node:http", { alternative: "HttpClient", module: "http", package: "effect/unstable/http" }],
  ["https", { alternative: "HttpClient", module: "https", package: "effect/unstable/http" }],
  ["node:https", { alternative: "HttpClient", module: "https", package: "effect/unstable/http" }]
])

export const nodeBuiltinImport = LSP.createDiagnostic({
  name: "nodeBuiltinImport",
  code: 52,
  description: "Warns when importing Node.js built-in modules that have Effect-native counterparts",
  group: "effectNative",
  severity: "off",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("nodeBuiltinImport.apply")(function*(sourceFile, report) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const moduleAlternatives = typeParser.supportedEffect() === "v3" ? moduleAlternativesV3 : moduleAlternativesV4

    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const specifier = statement.moduleSpecifier.text
        const match = moduleAlternatives.get(specifier)
        if (match) {
          report({
            location: statement.moduleSpecifier,
            messageText:
              `This module reference uses the \`${match.module}\` module, the corresponding Effect API is \`${match.alternative}\` from \`${match.package}\`.`,
            fixes: []
          })
        }
      } else if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (
            decl.initializer && ts.isCallExpression(decl.initializer) &&
            ts.isIdentifier(decl.initializer.expression) && ts.idText(decl.initializer.expression) === "require" &&
            decl.initializer.arguments.length === 1 && ts.isStringLiteral(decl.initializer.arguments[0])
          ) {
            const arg = decl.initializer.arguments[0]
            const specifier = arg.text
            const match = moduleAlternatives.get(specifier)
            if (match) {
              report({
                location: arg,
                messageText:
                  `This module reference uses the \`${match.module}\` module, the corresponding Effect API is \`${match.alternative}\` from \`${match.package}\`.`,
                fixes: []
              })
            }
          }
        }
      }
    }
  })
})
