import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import type ts from "typescript"
import * as LSP from "../core/LSP.js"
import * as Nano from "../core/Nano.js"
import * as TypeCheckerApi from "../core/TypeCheckerApi.js"
import * as TypeCheckerUtils from "../core/TypeCheckerUtils.js"
import * as TypeParser from "../core/TypeParser.js"
import * as TypeScriptApi from "../core/TypeScriptApi.js"
import * as TypeScriptUtils from "../core/TypeScriptUtils.js"
import * as StructuralSchemaGen from "../utils/StructuralSchemaGen.js"

export const typeToSchema = LSP.createCodegen({
  name: "typeToSchema",
  apply: Nano.fn("typeToSchema.apply")(function*(sourceFile, textRange) {
    const ts = yield* Nano.service(TypeScriptApi.TypeScriptApi)
    const tsUtils = yield* Nano.service(TypeScriptUtils.TypeScriptUtils)
    const typeChecker = yield* Nano.service(TypeCheckerApi.TypeCheckerApi)
    const typeCheckerUtils = yield* Nano.service(TypeCheckerUtils.TypeCheckerUtils)
    const typeParser = yield* Nano.service(TypeParser.TypeParser)
    const program = yield* Nano.service(TypeScriptApi.TypeScriptProgram)

    const inThisFile = yield* LSP.getCodegensForSourceFile([typeToSchema], sourceFile)
    if (inThisFile.length > 1) {
      return yield* Nano.fail(
        new LSP.CodegenNotApplicableError("the typeToSchema codegen can be used only once per file")
      )
    }

    const parse = (node: ts.Node) =>
      Nano.gen(function*() {
        if (!ts.isTypeAliasDeclaration(node)) {
          return yield* Nano.fail(
            new LSP.CodegenNotApplicableError(
              "this codegen is applicable only to a type alias where each object member is a schema to generate. e.g. `type ToGenerate = { UserSchema: User, TodoSchema: Todo}`"
            )
          )
        }

        const type = typeChecker.getTypeAtLocation(node.name)
        if (!type) {
          return yield* Nano.fail(
            new LSP.CodegenNotApplicableError(
              "error getting the type to process"
            )
          )
        }

        const nameToType = new Map<string, ts.Type>()
        const typeProperties = typeChecker.getPropertiesOfType(type)
        for (const symProp of typeProperties) {
          const symName = ts.symbolName(symProp)
          const propType = typeChecker.getTypeOfSymbolAtLocation(symProp, node)
          if (propType) nameToType.set(symName, propType)
        }

        const hash = pipe(
          Array.fromIterable(nameToType),
          Array.map(([name, type]) => {
            const typeString = typeChecker.typeToString(
              type,
              node,
              ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseStructuralFallback
            )
            return name + ": " + typeString
          }),
          Array.join("\n"),
          LSP.cyrb53
        )

        return ({
          hash,
          nameToType
        })
      })

    const nodeAndCommentRange = tsUtils.findNodeWithLeadingCommentAtPosition(sourceFile, textRange.pos)
    if (!nodeAndCommentRange) {
      return yield* Nano.fail(new LSP.CodegenNotApplicableError("no node and comment range affected"))
    }

    return yield* pipe(
      parse(nodeAndCommentRange.node),
      Nano.map((_) =>
        ({
          hash: _.hash,
          description: "Generate Schemas from types",
          apply: pipe(
            Nano.gen(function*() {
              const changeTracker = yield* Nano.service(TypeScriptApi.ChangeTracker)
              const ctx = yield* StructuralSchemaGen.process(
                sourceFile,
                nodeAndCommentRange.node,
                _.nameToType,
                true,
                true
              )
              const pos = sourceFile.end
              for (const range of ctx.rangesToDelete) {
                changeTracker.deleteRange(sourceFile, range)
              }
              for (const statement of ctx.schemaStatements) {
                changeTracker.insertNodeAt(sourceFile, pos, statement, { prefix: "\n", suffix: "\n" })
              }
            }),
            Nano.provideService(TypeScriptApi.TypeScriptApi, ts),
            Nano.provideService(TypeScriptUtils.TypeScriptUtils, tsUtils),
            Nano.provideService(TypeCheckerApi.TypeCheckerApi, typeChecker),
            Nano.provideService(TypeCheckerUtils.TypeCheckerUtils, typeCheckerUtils),
            Nano.provideService(TypeParser.TypeParser, typeParser),
            Nano.provideService(TypeScriptApi.TypeScriptProgram, program)
          )
        }) satisfies LSP.ApplicableCodegenDefinition
      )
    )
  })
})
