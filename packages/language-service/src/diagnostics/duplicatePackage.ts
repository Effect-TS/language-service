import * as LanguageServicePluginOptions from "../core/LanguageServicePluginOptions.js"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeParser from "../core/TypeParser.js"

export const duplicatePackage = LSP.createDiagnostic({
  name: "duplicatePackage",
  code: 6,
  description: "Detects when multiple versions of the same Effect package are loaded",
  group: "correctness",
  severity: "warning",
  fixable: false,
  supportedEffect: ["v3", "v4"],
  apply: Nano.fn("duplicatePackage.apply")(function*(sourceFile, report) {
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const options = yield* Nano.service(LanguageServicePluginOptions.LanguageServicePluginOptions)

    if (sourceFile.statements.length < 1) return

    const resolvedPackages = typeParser.getEffectRelatedPackages(sourceFile)

    for (const packageName of Object.keys(resolvedPackages)) {
      if (options.allowedDuplicatedPackages.indexOf(packageName) > -1) return
      if (Object.keys(resolvedPackages[packageName]).length > 1) {
        const versions = Object.keys(resolvedPackages[packageName])
        report({
          location: sourceFile.statements[0],
          messageText: `Multiple versions of package \`${packageName}\` were detected: ${
            versions.join(", ")
          }. Package duplication can change runtime identity and type equality across Effect modules.\nIf this is intentional, set the LSP config \`allowedDuplicatedPackages\` to ${
            JSON.stringify(options.allowedDuplicatedPackages.concat([packageName]))
          }.\n\n${
            versions.map((version) => `- found ${version} at ${resolvedPackages[packageName][version]}`).join("\n")
          }`,
          fixes: []
        })
      }
    }
  })
})
