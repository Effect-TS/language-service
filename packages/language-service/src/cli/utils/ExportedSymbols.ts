import type * as ts from "typescript"

/**
 * Location information for an exported symbol
 */
export interface SymbolLocation {
  readonly filePath: string
  readonly line: number
  readonly column: number
}

/**
 * Information about an exported symbol
 */
export interface ExportedSymbolInfo {
  readonly symbol: ts.Symbol
  readonly name: string
  readonly location: SymbolLocation
  readonly type: ts.Type
  readonly description: string | undefined
}

/**
 * Gets the location info from a declaration
 */
const getLocationFromDeclaration = (
  declaration: ts.Declaration,
  tsInstance: typeof ts
): SymbolLocation | undefined => {
  const sourceFile = declaration.getSourceFile()
  if (!sourceFile) return undefined
  const { character, line } = tsInstance.getLineAndCharacterOfPosition(sourceFile, declaration.getStart())
  return {
    filePath: sourceFile.fileName,
    line: line + 1,
    column: character + 1
  }
}

/**
 * Collects all exported symbols from a source file, including nested properties.
 * For example, if a module exports `Foo` which has a `Default` property, this will
 * return both `Foo` and `Foo.Default` as separate entries.
 *
 * @param sourceFile - The source file to collect exports from
 * @param tsInstance - The TypeScript instance
 * @param typeChecker - The TypeScript type checker
 * @param maxSymbolDepth - Maximum depth to traverse nested properties.
 *                         0 = only root exports, 1 = root + one level of properties, etc.
 *                         Default is 0 (only root exports).
 */
export const collectSourceFileExportedSymbols = (
  sourceFile: ts.SourceFile,
  tsInstance: typeof ts,
  typeChecker: ts.TypeChecker,
  maxSymbolDepth: number = 0
): Array<ExportedSymbolInfo> => {
  const result: Array<ExportedSymbolInfo> = []

  // Get the module symbol for the source file
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) {
    return result
  }

  // Get all exports from the module
  const exports = typeChecker.getExportsOfModule(moduleSymbol)

  // Work queue: [symbol, qualifiedName, location | undefined, depth]
  // Initialize with exported symbols using their names and declaration locations at depth 0
  const workQueue: Array<[ts.Symbol, string, SymbolLocation | undefined, number]> = exports.map((s) => {
    const declarations = s.declarations
    const location = declarations && declarations.length > 0
      ? getLocationFromDeclaration(declarations[0], tsInstance)
      : undefined
    return [s, tsInstance.symbolName(s), location, 0]
  })

  // Track which symbols have been exploded (properties added to queue)
  const exploded = new WeakSet<ts.Symbol>()

  while (workQueue.length > 0) {
    const [symbol, name, location, depth] = workQueue.shift()!

    if (!location) continue

    const type = typeChecker.getTypeOfSymbol(symbol)

    // Explode symbol: add its properties to the queue (only once per symbol)
    // Child symbols inherit the parent's code location
    // Only explode if we haven't reached maxSymbolDepth
    if (!exploded.has(symbol) && depth < maxSymbolDepth) {
      exploded.add(symbol)

      const properties = typeChecker.getPropertiesOfType(type)
      for (const propSymbol of properties) {
        const propName = tsInstance.symbolName(propSymbol)
        // Skip prototype property - it contains instance type, not a real export
        if (propName === "prototype") continue
        const childName = `${name}.${propName}`
        workQueue.push([propSymbol, childName, location, depth + 1])
      }
    }

    // Get JSDoc description if available
    const docComment = symbol.getDocumentationComment(typeChecker)
    const description = docComment.length > 0
      ? docComment.map((part) => part.text).join("")
      : undefined

    result.push({
      symbol,
      name,
      location,
      type,
      description
    })
  }

  return result
}
