import * as Data from "effect/Data"

/**
 * Error: Package.json file not found
 */
export class PackageJsonNotFoundError extends Data.TaggedError("PackageJsonNotFoundError")<{
  readonly path: string
}> {
  get message() {
    return `No package.json found at ${this.path}. Please run this command in the root of your project.`
  }
}

/**
 * Error: tsconfig file not found
 */
export class TsConfigNotFoundError extends Data.TaggedError("TsConfigNotFoundError")<{
  readonly path: string
}> {
  get message() {
    return `No tsconfig file found at ${this.path}.`
  }
}

/**
 * Error: Unable to read file
 */
export class FileReadError extends Data.TaggedError("FileReadError")<{
  readonly path: string
  readonly cause: unknown
}> {
  get message() {
    return `Unable to read file at ${this.path}`
  }
}
