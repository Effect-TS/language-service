# @effect/language-service

## 0.69.0

### Minor Changes

- [#608](https://github.com/Effect-TS/language-service/pull/608) [`bc7da1e`](https://github.com/Effect-TS/language-service/commit/bc7da1ef6f0f3d4aa0e88ef28de49e6845c764df) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `effectFnIife` diagnostic to warn when `Effect.fn` or `Effect.fnUntraced` is used as an IIFE (Immediately Invoked Function Expression).

  `Effect.fn` is designed to create reusable functions that can take arguments and provide tracing. When used as an IIFE, `Effect.gen` is more appropriate.

  **Example:**

  ```ts
  // Before (triggers warning)
  const result = Effect.fn("test")(function* () {
    yield* Effect.succeed(1);
  })();

  // After (using Effect.gen)
  const result = Effect.gen(function* () {
    yield* Effect.succeed(1);
  });
  ```

  A quick fix is provided to automatically convert `Effect.fn` IIFEs to `Effect.gen`.

## 0.68.0

### Minor Changes

- [#603](https://github.com/Effect-TS/language-service/pull/603) [`d747210`](https://github.com/Effect-TS/language-service/commit/d747210f173d87e068ad2370f6b7667be7cde07d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Added `instanceOfSchema` diagnostic that suggests using `Schema.is` instead of `instanceof` for Effect Schema types.

  Example:

  ```typescript
  import { Schema } from "effect"

  const MySchema = Schema.Struct({ name: Schema.String })

  // Before - triggers diagnostic
  if (value instanceof MySchema) { ... }

  // After - using Schema.is
  if (Schema.is(MySchema)(value)) { ... }
  ```

  The diagnostic is disabled by default and can be enabled with `instanceOfSchema:suggestion` or `instanceOfSchema:warning`.

### Patch Changes

- [#605](https://github.com/Effect-TS/language-service/pull/605) [`d63d5df`](https://github.com/Effect-TS/language-service/commit/d63d5df97858c8fd5a5af325141b08414f3d6eca) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve `leakingRequirements` diagnostic message for clarity

## 0.67.0

### Minor Changes

- [#599](https://github.com/Effect-TS/language-service/pull/599) [`4c9f5c7`](https://github.com/Effect-TS/language-service/commit/4c9f5c7c27e551e23c12ba31e07a955c5e15f5c9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `quickfixes` CLI command that shows diagnostics with available quick fixes and their proposed code changes.

  Example usage:

  ```bash
  # Check a specific file
  effect-language-service quickfixes --file ./src/index.ts

  # Check an entire project
  effect-language-service quickfixes --project ./tsconfig.json
  ```

  The command displays each diagnostic along with the available code fixes and a diff preview of the proposed changes, making it easy to see what automatic fixes are available before applying them.

### Patch Changes

- [#601](https://github.com/Effect-TS/language-service/pull/601) [`c0a6da3`](https://github.com/Effect-TS/language-service/commit/c0a6da3811915b53e04cc1a237c4fa93d6fc91b0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Reduce over-suggestion of effectFnOpportunity diagnostic for regular functions.

  The diagnostic now only suggests `Effect.fn` for regular functions (not using `Effect.gen`) when:

  - The function has a block body (not a concise arrow expression)
  - The function body has more than 5 statements

  Functions using `Effect.gen` are still always suggested regardless of body size.

## 0.66.1

### Patch Changes

- [#597](https://github.com/Effect-TS/language-service/pull/597) [`3833a10`](https://github.com/Effect-TS/language-service/commit/3833a10e3188c4ebf113625c00f60e17b8bf6b80) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improved `effectFnOpportunity` diagnostic message to mention that Effect.fn accepts piped transformations as additional arguments when pipe transformations are detected.

  When a function has `.pipe()` calls that would be absorbed by Effect.fn, the message now includes: "Effect.fn also accepts the piped transformations as additional arguments."

## 0.66.0

### Minor Changes

- [#594](https://github.com/Effect-TS/language-service/pull/594) [`0b9b37c`](https://github.com/Effect-TS/language-service/commit/0b9b37cc631aa29efff6c4b7bb07f5611d2d6d8d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `preferSchemaOverJson` diagnostic that suggests using Effect Schema for JSON operations instead of `JSON.parse`/`JSON.stringify` inside Effect contexts (`Effect.try`, `Effect.gen`, `Effect.fn`).

  ```ts
  // Before - triggers diagnostic
  const program = Effect.try(() => JSON.parse('{"name":"John"}'));

  const program2 = Effect.gen(function* () {
    const parsed = JSON.parse('{"name":"John"}');
    return parsed;
  });

  // After - use Effect Schema
  import { Schema } from "effect";

  const Person = Schema.Struct({ name: Schema.String });

  const program = Schema.decode(Person)('{"name":"John"}');

  const program2 = Effect.gen(function* () {
    const parsed = yield* Schema.decode(Person)('{"name":"John"}');
    return parsed;
  });
  ```

- [#593](https://github.com/Effect-TS/language-service/pull/593) [`f4d888d`](https://github.com/Effect-TS/language-service/commit/f4d888dd87c892aeb219c60cbc9aca0a25794eb5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `schemaSyncInEffect` diagnostic that warns when using `Schema.decodeSync`, `Schema.decodeUnknownSync`, `Schema.encodeSync`, or `Schema.encodeUnknownSync` inside Effect generators (`Effect.gen`, `Effect.fn`, `Effect.fnUntraced`), suggesting the use of Effect-based alternatives (`Schema.decode`, `Schema.decodeUnknown`, `Schema.encode`, `Schema.encodeUnknown`) for properly typed `ParseError` in the error channel.

  ```ts
  // Before - triggers diagnostic
  const program = Effect.gen(function* () {
    const person = Schema.decodeSync(Person)(input);
    return person;
  });

  // After - use Effect-based method
  const program = Effect.gen(function* () {
    const person = yield* Schema.decode(Person)(input);
    return person;
  });
  ```

  Also adds `findEnclosingScopes` helper to TypeParser for reusable scope detection logic.

### Patch Changes

- [#595](https://github.com/Effect-TS/language-service/pull/595) [`f54ef88`](https://github.com/Effect-TS/language-service/commit/f54ef887a9e9d921cdf674a3d8e291e2b07ef04b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Tone down `effectFnOpportunity` diagnostic to skip suggestions when function parameters are referenced inside pipe transformations. Converting such functions to `Effect.fn` would break the code since parameters would no longer be in scope for the pipe arguments.

  ```ts
  // This no longer triggers the diagnostic because `a` and `b` are used in the pipe
  export const shouldSkip = (a: number, b: string) => {
    return Effect.gen(function* () {
      yield* Effect.succeed(a);
      return b;
    }).pipe(Effect.withSpan("withParameters", { attributes: { a, b } }));
  };
  ```

- [#588](https://github.com/Effect-TS/language-service/pull/588) [`689059d`](https://github.com/Effect-TS/language-service/commit/689059d2ca143ed3bc482d138a48c7898574cb35) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - The `effectFnOpportunity` diagnostic now also supports regular functions that return an Effect, not just those using `Effect.gen`.

- [#596](https://github.com/Effect-TS/language-service/pull/596) [`8f00287`](https://github.com/Effect-TS/language-service/commit/8f00287617a682a38aec23c789d88ac68d269db5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improved `missedPipeableOpportunity` diagnostic to check if callees are safe to use in pipes without losing `this` context.

  The diagnostic now stops accumulating transformations when it encounters an unsafe callee (like method calls on class instances) and wraps the result with any remaining outer transformations.

  Safe callees include:

  - Property access on modules/namespaces (e.g., `Effect.map`)
  - Standalone function identifiers
  - Call expressions (already evaluated)
  - Arrow functions and function expressions

  Example - before this change, the diagnostic would incorrectly suggest:

  ```typescript
  // Input
  console.log(Effect.runPromise(Effect.ignore(Effect.log("Hello"))));

  // Would produce (incorrect - loses console.log wrapper)
  Effect.log("Hello").pipe(Effect.ignore, Effect.runPromise);
  ```

  Now it correctly produces:

  ```typescript
  // Input
  console.log(Effect.runPromise(Effect.ignore(Effect.log("Hello"))));

  // Output (correct - preserves console.log wrapper)
  console.log(Effect.log("Hello").pipe(Effect.ignore, Effect.runPromise));
  ```

## 0.65.0

### Minor Changes

- [#581](https://github.com/Effect-TS/language-service/pull/581) [`4569328`](https://github.com/Effect-TS/language-service/commit/456932800d7abe81e14d910b25d91399277a23f5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `effectFnOpportunity` diagnostic that suggests converting functions returning `Effect.gen` to `Effect.fn` for better tracing and concise syntax.

  The diagnostic triggers on:

  - Arrow functions returning `Effect.gen(...)`
  - Function expressions returning `Effect.gen(...)`
  - Function declarations returning `Effect.gen(...)`
  - Functions with `Effect.gen(...).pipe(...)` patterns

  It provides two code fixes:

  - Convert to `Effect.fn` (traced) - includes the function name as the span name
  - Convert to `Effect.fnUntraced` - without tracing

  The diagnostic skips:

  - Generator functions (can't be converted)
  - Named function expressions (typically used for recursion)
  - Functions with multiple call signatures (overloads)

  When the original function has a return type annotation, the converted function will use `Effect.fn.Return<A, E, R>` as the return type.

  Example:

  ```ts
  // Before
  export const myFunction = (a: number) =>
    Effect.gen(function* () {
      yield* Effect.succeed(1);
      return a;
    });

  // After (with Effect.fn)
  export const myFunction = Effect.fn("myFunction")(function* (a: number) {
    yield* Effect.succeed(1);
    return a;
  });

  // Before (with pipe)
  export const withPipe = () =>
    Effect.gen(function* () {
      return yield* Effect.succeed(1);
    }).pipe(Effect.withSpan("withPipe"));

  // After (with Effect.fn)
  export const withPipe = Effect.fn("withPipe")(function* () {
    return yield* Effect.succeed(1);
  }, Effect.withSpan("withPipe"));
  ```

- [#575](https://github.com/Effect-TS/language-service/pull/575) [`00aeed0`](https://github.com/Effect-TS/language-service/commit/00aeed0c8aadcd0b0c521e4339aa6a1a18eae772) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `effectMapVoid` diagnostic that suggests using `Effect.asVoid` instead of `Effect.map(() => void 0)`, `Effect.map(() => undefined)`, or `Effect.map(() => {})`.

  Also adds two new TypeParser utilities:

  - `lazyExpression`: matches zero-argument arrow functions or function expressions that return a single expression
  - `emptyFunction`: matches arrow functions or function expressions with an empty block body

  And adds `isVoidExpression` utility to TypeScriptUtils for detecting `void 0` or `undefined` expressions.

  Example:

  ```ts
  // Before
  Effect.succeed(1).pipe(Effect.map(() => void 0));
  Effect.succeed(1).pipe(Effect.map(() => undefined));
  Effect.succeed(1).pipe(Effect.map(() => {}));

  // After (suggested fix)
  Effect.succeed(1).pipe(Effect.asVoid);
  ```

- [#582](https://github.com/Effect-TS/language-service/pull/582) [`94d4a6b`](https://github.com/Effect-TS/language-service/commit/94d4a6bcaa39d8b33e66390d1ead5b1da1a8f16f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Added `layerinfo` CLI command that provides detailed information about a specific exported layer.

  Features:

  - Shows layer type, location, and description
  - Lists services the layer provides and requires
  - Suggests optimal layer composition order using `Layer.provide`, `Layer.provideMerge`, and `Layer.merge`

  Example usage:

  ```bash
  effect-language-service layerinfo --file ./src/layers/app.ts --name AppLive
  ```

  Also added a tip to both `overview` and `layerinfo` commands about using `Layer.mergeAll(...)` to get suggested composition order.

- [#583](https://github.com/Effect-TS/language-service/pull/583) [`b0aa78f`](https://github.com/Effect-TS/language-service/commit/b0aa78fb75f2afed944fb062e8e74ec6eb1492c1) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `redundantSchemaTagIdentifier` diagnostic that suggests removing redundant identifier arguments when they equal the tag value in `Schema.TaggedClass`, `Schema.TaggedError`, or `Schema.TaggedRequest`.

  **Before:**

  ```typescript
  class MyError extends Schema.TaggedError<MyError>("MyError")("MyError", {
    message: Schema.String,
  }) {}
  ```

  **After applying the fix:**

  ```typescript
  class MyError extends Schema.TaggedError<MyError>()("MyError", {
    message: Schema.String,
  }) {}
  ```

  Also updates the completions to not include the redundant identifier when autocompleting `Schema.TaggedClass`, `Schema.TaggedError`, and `Schema.TaggedRequest`.

- [#573](https://github.com/Effect-TS/language-service/pull/573) [`6715f91`](https://github.com/Effect-TS/language-service/commit/6715f9131059737cf4b2d2988d7981971943ac0e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Rename `reportSuggestionsAsWarningsInTsc` option to `includeSuggestionsInTsc` and change default to `true`.

  This option controls whether diagnostics with "suggestion" severity are included in TSC output when using the `effect-language-service patch` feature. When enabled, suggestions are reported as messages in TSC output, which is useful for LLM-based development tools to see all suggestions.

  **Breaking change**: The option has been renamed and the default behavior has changed:

  - Old: `reportSuggestionsAsWarningsInTsc: false` (suggestions not included by default)
  - New: `includeSuggestionsInTsc: true` (suggestions included by default)

  To restore the previous behavior, set `"includeSuggestionsInTsc": false` in your tsconfig.json plugin configuration.

- [#586](https://github.com/Effect-TS/language-service/pull/586) [`e225b5f`](https://github.com/Effect-TS/language-service/commit/e225b5fb242d269b75eb6a04c89ae6372e53c8ec) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add markdown documentation support to setup command

  The setup command now automatically manages Effect Language Service documentation in AGENTS.md and CLAUDE.md files:

  - When installing: Adds or updates the Effect Language Service section with markers
  - When uninstalling: Removes the section if present
  - Case-insensitive file detection (supports both lowercase and uppercase filenames)
  - Skips symlinked files to avoid modifying linked content
  - Shows proper diff view for markdown file changes

  Example section added to markdown files:

  ```markdown
  <!-- effect-language-service:start -->

  ## Effect Language Service

  The Effect Language Service comes in with a useful CLI that can help you with commands to get a better understanding your Effect Layers and Services, and to help you compose them correctly.

  <!-- effect-language-service:end -->
  ```

### Patch Changes

- [#580](https://github.com/Effect-TS/language-service/pull/580) [`a45606b`](https://github.com/Effect-TS/language-service/commit/a45606b2b0d64bd06436c1e6c3a1c5410dcda6a9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `Effect.fn` and `Effect.fnUntraced` support to the piping flows parser.

  The piping flows parser now recognizes pipe transformations passed as additional arguments to `Effect.fn`, `Effect.fn("traced")`, and `Effect.fnUntraced`. This enables diagnostics like `catchAllToMapError`, `catchUnfailableEffect`, and `multipleEffectProvide` to work with these patterns.

  Example:

  ```ts
  // This will now trigger the catchAllToMapError diagnostic
  const example = Effect.fn(
    function* () {
      return yield* Effect.fail("error");
    },
    Effect.catchAll((cause) => Effect.fail(new MyError(cause)))
  );
  ```

- [#587](https://github.com/Effect-TS/language-service/pull/587) [`7316859`](https://github.com/Effect-TS/language-service/commit/7316859ba221a212d3e8adcf458032e5c5d1b354) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Mark deprecated TypeScript Signature methods and migrate to property accessors

  Added `@deprecated` annotations to TypeScript Signature interface methods (`getParameters`, `getTypeParameters`, `getDeclaration`, `getReturnType`, `getTypeParameterAtPosition`) with guidance to use their modern property alternatives. Updated codebase usage of `getParameters()` to use `.parameters` property instead.

- [#584](https://github.com/Effect-TS/language-service/pull/584) [`ed12861`](https://github.com/Effect-TS/language-service/commit/ed12861c12a1fa1298fd53c97a5e01a2d02b96ac) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix TypeError in setup command when updating existing diagnosticSeverity configuration

  The setup command was throwing `TypeError: Cannot read properties of undefined (reading 'text')` when trying to update the `diagnosticSeverity` option of an existing `@effect/language-service` plugin configuration in tsconfig.json.

  This occurred because TypeScript's ChangeTracker formatter needed to compute indentation by traversing the AST tree, which failed when replacing a PropertyAssignment node inside a nested list context.

  The fix replaces just the initializer value (ObjectLiteralExpression) instead of the entire PropertyAssignment, avoiding the problematic list indentation calculation.

- [#585](https://github.com/Effect-TS/language-service/pull/585) [`7ebe5db`](https://github.com/Effect-TS/language-service/commit/7ebe5db2d60f36510e666e7c816623c0f9be88ab) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Enhanced `layerinfo` CLI command with output type selection for layer composition.

  **New Features:**

  - Added `--outputs` option to select which output types to include in the suggested composition (e.g., `--outputs 1,2,3`)
  - Shows all available output types from the layer graph with indexed checkboxes
  - By default, only types that are in the layer's declared `ROut` are selected
  - Composition code now includes `export const <name> = ...` prefix for easy copy-paste

  **Example output:**

  ```
  Suggested Composition:
    Not sure you got your composition right? Just write all layers inside a Layer.mergeAll(...)
    then run this command again and use --outputs to select which outputs to include in composition.
    Example: --outputs 1,2,3

    [ ] 1. Cache
    [x] 2. UserRepository

    export const simplePipeIn = UserRepository.Default.pipe(
      Layer.provide(Cache.Default)
    )
  ```

  This allows users to see all available outputs from a layer composition and choose which ones to include in the suggested composition order.

- [#577](https://github.com/Effect-TS/language-service/pull/577) [`0ed50c3`](https://github.com/Effect-TS/language-service/commit/0ed50c33c08ae6ae81fbd4af49ac4d75fd2b7f74) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor `catchAllToMapError` diagnostic to use the piping flows parser for detecting Effect.catchAll calls.

  This change also:

  - Makes `outType` optional in `ParsedPipingFlowSubject` to handle cases where type information is unavailable
  - Sorts piping flows by position for consistent ordering

- [#578](https://github.com/Effect-TS/language-service/pull/578) [`cab6ce8`](https://github.com/Effect-TS/language-service/commit/cab6ce85ff2720c0d09cdb0b708d77d1917a50c5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - refactor: use piping flows parser in catchUnfailableEffect diagnostic

- [#579](https://github.com/Effect-TS/language-service/pull/579) [`2a82522`](https://github.com/Effect-TS/language-service/commit/2a82522cdbcb59465ccb93dcb797f55d9408752c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - refactor: use piping flows parser in multipleEffectProvide diagnostic

- [#570](https://github.com/Effect-TS/language-service/pull/570) [`0db6e28`](https://github.com/Effect-TS/language-service/commit/0db6e28df1caba1bb5bc42faf82f8ffab276a184) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor CLI overview command to extract symbol collection logic into reusable utility

  - Extract `collectSourceFileExportedSymbols` into `src/cli/utils/ExportedSymbols.ts` for reuse across CLI commands
  - Add `--max-symbol-depth` option to overview command (default: 3) to control how deep to traverse nested symbol properties
  - Add tests for the overview command with snapshot testing

- [#574](https://github.com/Effect-TS/language-service/pull/574) [`9d0695e`](https://github.com/Effect-TS/language-service/commit/9d0695e3c82333400575a9d266cad4ac6af45ccc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Remove deprecated ts-patch documentation from README. The Effect LSP CLI Patch is now the only recommended approach for getting diagnostics at compile time.

- [#576](https://github.com/Effect-TS/language-service/pull/576) [`5017d75`](https://github.com/Effect-TS/language-service/commit/5017d75f1db93f6e5d8c1fc0d8ea26c2b2db613a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add piping flows parser for caching piping flow analysis per source file.

  This internal improvement introduces a `pipingFlows` function in `TypeParser` that analyzes and caches all piping flows (both `pipe()` calls and `.pipe()` method chains) in a source file. The parser:

  - Identifies piping flows including nested pipes and mixed call styles (e.g., `Effect.map(effect, fn).pipe(...)`)
  - Tracks the subject, transformations, and intermediate types for each flow
  - Enables more efficient diagnostic implementations by reusing cached analysis

  The `missedPipeableOpportunity` diagnostic has been refactored to use this new parser, improving performance when analyzing files with multiple piping patterns.

## 0.64.1

### Patch Changes

- [#568](https://github.com/Effect-TS/language-service/pull/568) [`477271d`](https://github.com/Effect-TS/language-service/commit/477271d4df19391dca4131a13c8962b134156272) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix auto-import with namespace import packages generating malformed code when the identifier is at the beginning of the file.

  When using `namespaceImportPackages` configuration and auto-completing an export like `isAnyKeyword` from `effect/SchemaAST`, the code was incorrectly generated as:

  ```ts
  SchemaAST.import * as SchemaAST from "effect/SchemaAST";
  ```

  Instead of the expected:

  ```ts
  import * as SchemaAST from "effect/SchemaAST";

  SchemaAST.isAnyKeyword;
  ```

  The fix ensures the import statement is added before the namespace prefix when both changes target position 0.

## 0.64.0

### Minor Changes

- [#567](https://github.com/Effect-TS/language-service/pull/567) [`dcb3fe5`](https://github.com/Effect-TS/language-service/commit/dcb3fe5f36f5c2727870e1fbc148e2a935a1a77e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Added new diagnostic `catchAllToMapError` that suggests using `Effect.mapError` instead of `Effect.catchAll` + `Effect.fail` when the callback only wraps the error.

  Before:

  ```ts
  Effect.catchAll((cause) => Effect.fail(new MyError(cause)));
  ```

  After:

  ```ts
  Effect.mapError((cause) => new MyError(cause));
  ```

  The diagnostic includes a quick fix that automatically transforms the code.

- [#555](https://github.com/Effect-TS/language-service/pull/555) [`0424000`](https://github.com/Effect-TS/language-service/commit/04240003bbcb04db1eda967153d185fd53a3f669) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `globalErrorInEffectCatch` diagnostic to detect global Error types in catch callbacks

  This new diagnostic warns when catch callbacks in `Effect.tryPromise`, `Effect.try`, `Effect.tryMap`, or `Effect.tryMapPromise` return the global `Error` type instead of typed errors.

  Using the global `Error` type in Effect failures is not recommended as they can get merged together, making it harder to distinguish between different error cases. Instead, it's better to use tagged errors (like `Data.TaggedError`) or custom errors with discriminator properties to enable proper type checking and error handling.

  Example of code that triggers the diagnostic:

  ```typescript
  Effect.tryPromise({
    try: () => fetch("http://example.com"),
    catch: () => new Error("Request failed"), // ⚠️ Warning: returns global Error type
  });
  ```

  Recommended approach:

  ```typescript
  class FetchError extends Data.TaggedError("FetchError")<{
    cause: unknown;
  }> {}

  Effect.tryPromise({
    try: () => fetch("http://example.com"),
    catch: (e) => new FetchError({ cause: e }), // ✅ Uses typed error
  });
  ```

  This diagnostic also improves the clarity message for the `leakingRequirements` diagnostic by adding additional guidance on how services should be collected in the layer creation body.

- [#558](https://github.com/Effect-TS/language-service/pull/558) [`cc5feb1`](https://github.com/Effect-TS/language-service/commit/cc5feb146de351a5466e8f8476e5b9d9020c797e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `layerMergeAllWithDependencies` diagnostic to detect interdependencies in `Layer.mergeAll` calls

  This new diagnostic warns when `Layer.mergeAll` is called with layers that have interdependencies, where one layer provides a service that another layer in the same call requires.

  `Layer.mergeAll` creates layers in parallel, so dependencies between layers will not be satisfied. This can lead to runtime errors when trying to use the merged layer.

  Example of code that triggers the diagnostic:

  ```typescript
  export class DbConnection extends Effect.Service<DbConnection>()(
    "DbConnection",
    {
      succeed: {},
    }
  ) {}
  export class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
    succeed: {},
  }) {}
  export class Cache extends Effect.Service<Cache>()("Cache", {
    effect: Effect.as(FileSystem, {}), // Cache requires FileSystem
  }) {}

  // ⚠️ Warning on FileSystem.Default
  const layers = Layer.mergeAll(
    DbConnection.Default,
    FileSystem.Default, // This provides FileSystem
    Cache.Default // This requires FileSystem
  );
  ```

  Recommended approach:

  ```typescript
  // Provide FileSystem separately before merging
  const layers = Layer.mergeAll(DbConnection.Default, Cache.Default).pipe(
    Layer.provideMerge(FileSystem.Default)
  );
  ```

  The diagnostic correctly handles pass-through layers (layers that both provide and require the same type) and only reports on layers that actually provide dependencies needed by other layers in the same `mergeAll` call.

- [#557](https://github.com/Effect-TS/language-service/pull/557) [`83ce411`](https://github.com/Effect-TS/language-service/commit/83ce411288977606f8390641dc7127e36c6f3c5b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `missingLayerContext` diagnostic to detect missing service requirements in Layer definitions

  This new diagnostic provides better error readability when you're missing service requirements in your Layer type definitions. It works similarly to the existing `missingEffectContext` diagnostic but specifically checks the `RIn` (requirements input) parameter of Layer types.

  Example of code that triggers the diagnostic:

  ```typescript
  import * as Effect from "effect/Effect";
  import * as Layer from "effect/Layer";

  class ServiceA extends Effect.Service<ServiceA>()("ServiceA", {
    succeed: { a: 1 },
  }) {}

  class ServiceB extends Effect.Service<ServiceB>()("ServiceB", {
    succeed: { a: 2 },
  }) {}

  declare const layerWithServices: Layer.Layer<ServiceA, never, ServiceB>;

  function testFn(layer: Layer.Layer<ServiceA>) {
    return layer;
  }

  // ⚠️ Error: Missing 'ServiceB' in the expected Layer context.
  testFn(layerWithServices);
  ```

  The diagnostic helps catch type mismatches early by clearly indicating which service requirements are missing when passing layers between functions or composing layers together.

- [#562](https://github.com/Effect-TS/language-service/pull/562) [`57d5af2`](https://github.com/Effect-TS/language-service/commit/57d5af251d3e477a8cf4c41dfae4593cede4c960) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `overview` CLI command that provides an overview of Effect-related exports in a project.

  The command analyzes TypeScript files and reports all exported yieldable errors, services (Context.Tag, Effect.Tag, Effect.Service), and layers with their types, file locations, and JSDoc descriptions. A progress spinner shows real-time file processing status.

  Usage:

  ```bash
  effect-language-service overview --file path/to/file.ts
  effect-language-service overview --project tsconfig.json
  ```

  Example output:

  ```
  ✔ Processed 3 file(s)
  Overview for 3 file(s).

  Yieldable Errors (1)
    NotFoundError
      ./src/errors.ts:5:1
      NotFoundError

  Services (2)
    DbConnection
      ./src/services/db.ts:6:1
      Manages database connections

  Layers (1)
    AppLive
      ./src/layers/app.ts:39:14
      Layer<Cache | UserRepository, never, never>
  ```

### Patch Changes

- [#561](https://github.com/Effect-TS/language-service/pull/561) [`c3b3bd3`](https://github.com/Effect-TS/language-service/commit/c3b3bd364ff3c0567995b3c12e579459b69448e7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add descriptions to CLI commands using `Command.withDescription` for improved help output when using `--help` flag.

- [#565](https://github.com/Effect-TS/language-service/pull/565) [`2274aef`](https://github.com/Effect-TS/language-service/commit/2274aef53902f2c31443b7e504d2add0bf24d6e4) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix `unnecessaryPipe` diagnostic and refactor not working with namespace imports from `effect/Function` (e.g., `Function.pipe()` or `Fn.pipe()`)

- [#560](https://github.com/Effect-TS/language-service/pull/560) [`75a480e`](https://github.com/Effect-TS/language-service/commit/75a480ebce3c5dfe29f22ee9d556ba1a043ba91b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve diagnostic message for `unsupportedServiceAccessors` when used with `Effect.Tag`

  When the `unsupportedServiceAccessors` diagnostic is triggered on an `Effect.Tag` class (which doesn't allow disabling accessors), the message now includes a helpful suggestion to use `Context.Tag` instead:

  ```typescript
  export class MyService extends Effect.Tag("MyService")<
    MyService,
    {
      method: <A>(value: A) => Effect.Effect<A>;
    }
  >() {}
  // Diagnostic: Even if accessors are enabled, accessors for 'method' won't be available
  // because the signature have generic type parameters or multiple call signatures.
  // Effect.Tag does not allow to disable accessors, so you may want to use Context.Tag instead.
  ```

- [#559](https://github.com/Effect-TS/language-service/pull/559) [`4c1f809`](https://github.com/Effect-TS/language-service/commit/4c1f809d2f88102652ceea67b93df8909b408d14) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve Layer Magic refactor ordering by considering both provided and required service counts

  The Layer Magic refactor now uses a combined ordering heuristic that considers both:

  1. The number of services a layer provides
  2. The number of services a layer requires

  This results in more optimal layer composition order, especially in complex dependency graphs where layers have varying numbers of dependencies.

- [#566](https://github.com/Effect-TS/language-service/pull/566) [`036c491`](https://github.com/Effect-TS/language-service/commit/036c49142581a1ea428205e3d3d1647963c556f9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Simplify diagnostic messages for global Error type usage

  The diagnostic messages for `globalErrorInEffectCatch` and `globalErrorInEffectFailure` now use the more generic term "tagged errors" instead of "tagged errors (Data.TaggedError)" to provide cleaner, more concise guidance.

## 0.63.2

### Patch Changes

- [#553](https://github.com/Effect-TS/language-service/pull/553) [`e64e3df`](https://github.com/Effect-TS/language-service/commit/e64e3dfe235398af388e7d3ffdd36dbd02422730) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - fix: ensure correct path resolution in CLI setup

  - Use `process.cwd()` explicitly in `path.resolve()` for consistent behavior
  - Resolve the selected tsconfig path to an absolute path before validation
  - Simplify error handling by using direct `yield*` for `TsConfigNotFoundError`

## 0.63.1

### Patch Changes

- [#551](https://github.com/Effect-TS/language-service/pull/551) [`9b3d807`](https://github.com/Effect-TS/language-service/commit/9b3d8071ec3af88ce219cc5a6a96e792bbdca2a2) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - fix: resolve TypeScript from project's working directory

  The CLI now attempts to resolve TypeScript from the current working directory first before falling back to the package's bundled version. This ensures the CLI uses the same TypeScript version as the project being analyzed.

## 0.63.0

### Minor Changes

- [#548](https://github.com/Effect-TS/language-service/pull/548) [`ef8c2de`](https://github.com/Effect-TS/language-service/commit/ef8c2de288a8450344157f726986a4f35736dd78) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `globalErrorInEffectFailure` diagnostic

  This diagnostic warns when `Effect.fail` is called with the global `Error` type. Using the global `Error` type in Effect failures is not recommended as they can get merged together, making it harder to distinguish between different error types.

  Instead, the diagnostic recommends using:

  - Tagged errors with `Data.TaggedError`
  - Custom error classes with a discriminator property (like `_tag`)

  Example:

  ```ts
  // This will trigger a warning
  Effect.fail(new Error("global error"));

  // These are recommended alternatives
  Effect.fail(new CustomError()); // where CustomError extends Data.TaggedError
  Effect.fail(new MyError()); // where MyError has a _tag property
  ```

- [#545](https://github.com/Effect-TS/language-service/pull/545) [`c590b5a`](https://github.com/Effect-TS/language-service/commit/c590b5af59cc5b656c02ea6e03ba63d110ea65d3) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `effect-language-service setup` CLI command

  This new command provides an interactive wizard to guide users through the complete installation and configuration of the Effect Language Service. The setup command:

  - Analyzes your repository structure (package.json, tsconfig files)
  - Guides you through adding the package to devDependencies
  - Configures the TypeScript plugin in your tsconfig.json
  - Allows customizing diagnostic severity levels
  - Optionally adds prepare script for automatic patching
  - Optionally configures VS Code settings for workspace TypeScript usage
  - Shows a review of all changes before applying them

  Example usage:

  ```bash
  effect-language-service setup
  ```

  The wizard will walk you through each step and show you exactly what changes will be made before applying them.

- [#550](https://github.com/Effect-TS/language-service/pull/550) [`4912ee4`](https://github.com/Effect-TS/language-service/commit/4912ee41531dc91ad0ba2828ea555cb79f2c6d9e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for `@effect/sql`'s `Model.Class` in completions and diagnostics

  - Added `effectSqlModelSelfInClasses` completion: Auto-completes the `Self` type parameter when extending `Model.Class` from `@effect/sql`
  - Extended `classSelfMismatch` diagnostic: Now detects when the `Self` type parameter in `Model.Class<Self>` doesn't match the actual class name

  Example:

  ```ts
  import { Model } from "@effect/sql";
  import * as Schema from "effect/Schema";

  // Completion triggers after "Model." to generate the full class boilerplate
  export class User extends Model.Class<User>("User")({
    id: Schema.String,
  }) {}

  // Diagnostic warns when Self type parameter doesn't match class name
  export class User extends Model.Class<WrongName>("User")({
    //                                    ^^^^^^^^^ Self type should be "User"
    id: Schema.String,
  }) {}
  ```

### Patch Changes

- [#547](https://github.com/Effect-TS/language-service/pull/547) [`9058a37`](https://github.com/Effect-TS/language-service/commit/9058a373ba1567a9336d0c3b36de981337757219) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - refactor: simplify `unnecessaryFailYieldableError` diagnostic implementation

  Changed the implementation to check if a type extends `Cause.YieldableError` on-demand rather than fetching all yieldable error types upfront.

- [#549](https://github.com/Effect-TS/language-service/pull/549) [`039f4b2`](https://github.com/Effect-TS/language-service/commit/039f4b21da6e1d6ae695ba26cce0516d09f86643) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `getTypeAtLocation` utility to `TypeCheckerUtils`

  This refactoring adds a new `getTypeAtLocation` function to `TypeCheckerUtils` that safely retrieves types while filtering out JSX-specific nodes (JSX elements, opening/closing tags, and JSX attributes) that could cause issues when calling `typeChecker.getTypeAtLocation`.

  The utility is now used across multiple diagnostics and features, reducing code duplication and ensuring consistent handling of edge cases:

  - `anyUnknownInErrorContext`
  - `catchUnfailableEffect`
  - `floatingEffect`
  - `globalErrorInEffectFailure`
  - `leakingRequirements`
  - `missedPipeableOpportunity`
  - `missingEffectServiceDependency`
  - `missingReturnYieldStar`
  - `multipleEffectProvide`
  - `nonObjectEffectServiceType`
  - `overriddenSchemaConstructor`
  - `returnEffectInGen`
  - `scopeInLayerEffect`
  - `strictBooleanExpressions`
  - `strictEffectProvide`
  - `unnecessaryFailYieldableError`
  - And other features like quick info, goto definition, and refactors

## 0.62.5

### Patch Changes

- [#543](https://github.com/Effect-TS/language-service/pull/543) [`0b13f3c`](https://github.com/Effect-TS/language-service/commit/0b13f3c862b69a84e2b3368ab301a35af8a8bf63) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix unwanted autocompletions inside import declarations

  Previously, Effect.**, Option.**, and Either.\_\_ completions were incorrectly suggested inside import statements. This has been fixed by detecting when the completion is requested inside an import declaration and preventing these completions from appearing.

  Closes #541

## 0.62.4

### Patch Changes

- [#539](https://github.com/Effect-TS/language-service/pull/539) [`4cc88d2`](https://github.com/Effect-TS/language-service/commit/4cc88d2c72535ef7608c4c0b0ecdd8b676699874) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve layerMagic refactor to prioritize layers with more provided services

  The layerMagic refactor now uses a heuristic that prioritizes nodes with more provided services when generating layer composition code. This ensures that telemetry and tracing layers (which typically provide fewer services) are positioned as late as possible in the dependency graph, resulting in more intuitive and correct layer ordering.

  Example: When composing layers for services that depend on HttpClient with telemetry, the refactor now correctly places the telemetry layer (which provides fewer services) later in the composition chain.

## 0.62.3

### Patch Changes

- [#537](https://github.com/Effect-TS/language-service/pull/537) [`e31c03b`](https://github.com/Effect-TS/language-service/commit/e31c03b086eebb2bb55f23cfb9eb4c26344785d7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix counter increment timing in structural type to schema refactor to ensure proper naming of conflicting schemas (e.g., `User_1` instead of `User_0` for the first conflict)

## 0.62.2

### Patch Changes

- [#535](https://github.com/Effect-TS/language-service/pull/535) [`361fc1e`](https://github.com/Effect-TS/language-service/commit/361fc1ee5b6cf7684e0cf1ff8806ef267936b9cd) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix duplicate schema names in "Refactor to Schema (Recursive Structural)" code generation.

  When the refactor encountered types with conflicting names, it was generating a unique suffix but not properly tracking the usage count, causing duplicate schema identifiers with different contents to be generated.

  This fix ensures that when a name conflict is detected and a unique suffix is added (e.g., `Tax`, `Tax_1`, `Tax_2`), the usage counter is properly incremented to prevent duplicate identifiers in the generated code.

  Fixes #534

## 0.62.1

### Patch Changes

- [#532](https://github.com/Effect-TS/language-service/pull/532) [`8f189aa`](https://github.com/Effect-TS/language-service/commit/8f189aa7d21b8a638e3bc9cf4fc834c684f1b70f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix handling of read-only arrays in "Refactor to Schema (Recursive Structural)" code generation.

  The refactor now correctly distinguishes between mutable arrays (`Array<T>`) and read-only arrays (`ReadonlyArray<T>` or `readonly T[]`):

  - `Array<T>` is now converted to `Schema.mutable(Schema.Array(...))` to preserve mutability
  - `ReadonlyArray<T>` and `readonly T[]` are converted to `Schema.Array(...)` (read-only by default)

  This fixes compatibility issues with external libraries (like Stripe, BetterAuth) that expect mutable arrays in their API parameters.

  Fixes #531

## 0.62.0

### Minor Changes

- [#528](https://github.com/Effect-TS/language-service/pull/528) [`7dc14cf`](https://github.com/Effect-TS/language-service/commit/7dc14cfaebe737f4c13ebd55f30e39207a5029bb) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add typeToSchema codegen

  This adds a new `// @effect-codegens typeToSchema` codegen that automatically generates Effect Schema classes from TypeScript types. Given a type alias with object members representing schemas to generate (e.g., `type ToGenerate = { UserSchema: User, TodoSchema: Todo }`), the codegen will create the corresponding Schema class definitions.

  The generated schemas:

  - Automatically detect and reuse existing schema definitions in the file
  - Support both type aliases and interfaces
  - Include outdated detection to warn when the source type changes
  - Work with the `outdatedEffectCodegen` diagnostic to provide automatic fix actions

  Example usage:

  ```typescript
  type User = {
    id: number;
    name: string;
  };

  // @effect-codegens typeToSchema
  export type ToGenerate = {
    UserSchema: User;
  };

  // Generated by the codegen:
  export class UserSchema extends Schema.Class<UserSchema>("UserSchema")({
    id: Schema.Number,
    name: Schema.String,
  }) {}
  ```

### Patch Changes

- [#530](https://github.com/Effect-TS/language-service/pull/530) [`5ecdc62`](https://github.com/Effect-TS/language-service/commit/5ecdc626dd6dcaad3e866b7e89decb10b99fca2d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix `Refactor to Schema (Recursive Structural)` to support `exactOptionalPropertyTypes`

  When `exactOptionalPropertyTypes` is enabled in tsconfig, optional properties with types like `string | undefined` are not assignable to types defined as `prop?: string`. This fix generates `Schema.optionalWith(Schema.String, { exact: true })` instead of `Schema.optional(Schema.Union(Schema.Undefined, Schema.String))` to maintain type compatibility with external libraries that don't always include `undefined` in their optional property types.

  Example:

  ```typescript
  // With exactOptionalPropertyTypes enabled
  type User = {
    name?: string; // External library type (e.g., Stripe API)
  };

  // Generated schema now uses:
  Schema.optionalWith(Schema.String, { exact: true });

  // Instead of:
  Schema.optional(Schema.Union(Schema.Undefined, Schema.String));
  ```

  This ensures the generated schema maintains proper type compatibility with external libraries when using strict TypeScript configurations.

## 0.61.0

### Minor Changes

- [#525](https://github.com/Effect-TS/language-service/pull/525) [`e2dbbad`](https://github.com/Effect-TS/language-service/commit/e2dbbad00b06fb576767a5330e1cca048480264a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add Structural Type to Schema refactor

  Adds a new "Structural Type to Schema" refactor that converts TypeScript interfaces and type aliases to Effect Schema classes. This refactor analyzes the structure of types and generates appropriate Schema definitions, with intelligent detection and reuse of existing schemas.

  Example:

  ```typescript
  // Before
  export interface User {
    id: number;
    name: string;
  }

  // After (using the refactor)
  export class User extends Schema.Class<User>("User")({
    id: Schema.Number,
    name: Schema.String,
  }) {}
  ```

  The refactor supports:

  - All primitive types and common TypeScript constructs
  - Automatic reuse of existing Schema definitions for referenced types
  - Optional properties, unions, intersections, and nested structures
  - Both interface and type alias declarations

## 0.60.0

### Minor Changes

- [#523](https://github.com/Effect-TS/language-service/pull/523) [`46ec3e1`](https://github.com/Effect-TS/language-service/commit/46ec3e14550edbf855f506a84c89c5096848ef85) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add configurable mermaid provider option

  Adds a new `mermaidProvider` configuration option that allows users to choose between different Mermaid diagram providers:

  - `"mermaid.com"` - Uses mermaidchart.com
  - `"mermaid.live"` - Uses mermaid.live (default)
  - Custom URL - Allows specifying a custom provider URL (e.g., `"http://localhost:8080"` for local mermaid-live-editor)

  This enhances flexibility for users who prefer different Mermaid visualization services or need to use self-hosted instances.

## 0.59.0

### Minor Changes

- [#518](https://github.com/Effect-TS/language-service/pull/518) [`660549d`](https://github.com/Effect-TS/language-service/commit/660549d2c07ecf9ccd59d9f022f5c97467f6fc17) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new `schemaStructWithTag` diagnostic that suggests using `Schema.TaggedStruct` instead of `Schema.Struct` when a `_tag` field with `Schema.Literal` is present. This makes the tag optional in the constructor, improving the developer experience.

  Example:

  ```typescript
  // Before (triggers diagnostic)
  export const User = Schema.Struct({
    _tag: Schema.Literal("User"),
    name: Schema.String,
    age: Schema.Number,
  });

  // After (applying quick fix)
  export const User = Schema.TaggedStruct("User", {
    name: Schema.String,
    age: Schema.Number,
  });
  ```

  The diagnostic includes a quick fix that automatically converts the `Schema.Struct` call to `Schema.TaggedStruct`, extracting the tag value and removing the `_tag` property from the fields.

### Patch Changes

- [#521](https://github.com/Effect-TS/language-service/pull/521) [`61f28ba`](https://github.com/Effect-TS/language-service/commit/61f28babbd909ef08be25fdcd684c81af683cd62) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix auto-completion for directly imported Effect APIs. Completions now work when using direct imports like `import { Service } from "effect/Effect"` instead of only working with fully qualified names like `Effect.Service`.

  This fix applies to:

  - `Effect.Service` and `Effect.Tag` from `effect/Effect`
  - `Schema.Class`, `Schema.TaggedError`, `Schema.TaggedClass`, and `Schema.TaggedRequest` from `effect/Schema`
  - `Data.TaggedError` and `Data.TaggedClass` from `effect/Data`
  - `Context.Tag` from `effect/Context`

  Example:

  ```typescript
  // Now works with direct imports
  import { Service } from "effect/Effect"
  export class MyService extends Service // ✓ Completion available

  // Still works with fully qualified names
  import * as Effect from "effect/Effect"
  export class MyService extends Effect.Service // ✓ Completion available
  ```

  Fixes #394

## 0.58.4

### Patch Changes

- [#515](https://github.com/Effect-TS/language-service/pull/515) [`b77b7e5`](https://github.com/Effect-TS/language-service/commit/b77b7e5f3492b5d1262d26eaa5a695e7f14e6392) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix toggle type annotation and toggle return type annotation refactors to handle unnamed/unresolved types

  The refactors now use `ts.NodeBuilderFlags.IgnoreErrors` flag when generating type annotations, allowing them to work correctly with types that have errors or are unnamed (e.g., `Schema.Struct({ ... }).make`). This prevents the refactors from failing when the type contains unresolved references or complex type expressions.

- [#514](https://github.com/Effect-TS/language-service/pull/514) [`ddabde2`](https://github.com/Effect-TS/language-service/commit/ddabde26021d9982a8ea02d6fb96414c39c3fb57) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix symbol resolution for aliased module exports. The TypeParser now correctly handles cases where symbols are exported from a module with an alias, improving the accuracy of type analysis for Effect modules.

## 0.58.3

### Patch Changes

- [#512](https://github.com/Effect-TS/language-service/pull/512) [`e3dc38e`](https://github.com/Effect-TS/language-service/commit/e3dc38e9318324e8c733aeee60a186a34ea3caa0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix type annotation context resolution in toggle refactors. When toggling type annotations or return type annotations, the refactors now correctly use the enclosing declaration node as context instead of the local node, which improves type resolution and prevents issues with type parameter scope.

## 0.58.2

### Patch Changes

- [#510](https://github.com/Effect-TS/language-service/pull/510) [`9064174`](https://github.com/Effect-TS/language-service/commit/90641746039377a60d4e2a6048bfc509518ebd8a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Extend `anyUnknownInErrorContext` diagnostic to also check Layer types

  The `anyUnknownInErrorContext` diagnostic now checks both Effect and Layer types for `any` or `unknown` in their error and requirements channels. This helps catch more cases where type information is being lost in your Effect applications.

  Example:

  ```typescript
  const effectUnknown = Effect.context<unknown>();
  const layerUnknown = Layer.effectDiscard(effectUnknown);
  // Now reports: This has unknown in the requirements channel which is not recommended.
  ```

  The diagnostic also now skips explicit Layer type annotations to avoid false positives on intentional type declarations.

## 0.58.1

### Patch Changes

- [#508](https://github.com/Effect-TS/language-service/pull/508) [`1a4446c`](https://github.com/Effect-TS/language-service/commit/1a4446ce115c3e89925ecd7ed3613100605cc798) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix `anyUnknownInErrorContext` diagnostic to exclude JSX elements from reporting false positives. The diagnostic will no longer incorrectly flag JSX tag names, self-closing elements, opening/closing elements, and attribute names.

  Example:

  ```tsx
  // Before: Would incorrectly report diagnostic on <MyComponent />
  const element = <MyComponent />;

  // After: No diagnostic, JSX elements are properly excluded
  const element = <MyComponent />;
  ```

## 0.58.0

### Minor Changes

- [#505](https://github.com/Effect-TS/language-service/pull/505) [`31cff49`](https://github.com/Effect-TS/language-service/commit/31cff498b6a3207eabe5609f677b202245f53967) Thanks [@clayroach](https://github.com/clayroach)! - Enhance `diagnostics` CLI command with new options for CI/CD integration and tooling:

  - **`--format`**: Output format selection (`json`, `pretty`, `text`, `github-actions`)

    - `json`: Machine-readable JSON output with structured diagnostics and summary
    - `pretty`: Colored output with context (default, original behavior)
    - `text`: Plain text output without colors
    - `github-actions`: GitHub Actions workflow commands for inline PR annotations

  - **`--strict`**: Treat warnings as errors (affects exit code)

  - **`--severity`**: Filter diagnostics by severity level (comma-separated: `error`, `warning`, `message`)

  - **Exit codes**: Returns exit code 1 when errors are found (or warnings in strict mode)

  Example usage:

  ```bash
  # JSON output for CI/CD pipelines
  effect-language-service diagnostics --project tsconfig.json --format json

  # GitHub Actions with inline annotations
  effect-language-service diagnostics --project tsconfig.json --format github-actions

  # Strict mode for CI (fail on warnings)
  effect-language-service diagnostics --project tsconfig.json --strict

  # Only show errors
  effect-language-service diagnostics --project tsconfig.json --severity error
  ```

  Closes Effect-TS/effect #5180.

## 0.57.1

### Patch Changes

- [#503](https://github.com/Effect-TS/language-service/pull/503) [`857e43e`](https://github.com/Effect-TS/language-service/commit/857e43e2580312963681d867e4f5daa409e1da78) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add codefix to `runEffectInsideEffect` diagnostic that automatically transforms `Effect.run*` calls to use `Runtime.run*` when inside nested Effect contexts. The codefix will extract or reuse an existing Effect runtime and replace the direct Effect run call with the appropriate Runtime method.

  Example:

  ```typescript
  // Before
  Effect.gen(function* () {
    websocket.onmessage = (event) => {
      Effect.runPromise(check);
    };
  });

  // After applying codefix
  Effect.gen(function* () {
    const effectRuntime = yield* Effect.runtime<never>();

    websocket.onmessage = (event) => {
      Runtime.runPromise(effectRuntime, check);
    };
  });
  ```

## 0.57.0

### Minor Changes

- [#500](https://github.com/Effect-TS/language-service/pull/500) [`acc2d43`](https://github.com/Effect-TS/language-service/commit/acc2d43d62df686a3cef13112ddd3653cf0181d0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new `annotate` codegen that automatically adds type annotations to exported constants based on their initializer types. This codegen can be used by adding `// @effect-codegens annotate` comments above variable declarations.

  Example:

  ```typescript
  // @effect-codegens annotate
  export const test = Effect.gen(function* () {
    if (Math.random() < 0.5) {
      return yield* Effect.fail("error");
    }
    return 1 as const;
  });
  // Becomes:
  // @effect-codegens annotate:5fce15f7af06d924
  export const test: Effect.Effect<1, string, never> = Effect.gen(function* () {
    if (Math.random() < 0.5) {
      return yield* Effect.fail("error");
    }
    return 1 as const;
  });
  ```

  The codegen automatically detects the type from the initializer and adds the appropriate type annotation, making code more explicit and type-safe.

- [#497](https://github.com/Effect-TS/language-service/pull/497) [`b188b74`](https://github.com/Effect-TS/language-service/commit/b188b74204bfd81b64b2266dd59465a2c7d2d34f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new diagnostic `unnecessaryFailYieldableError` that warns when using `yield* Effect.fail()` with yieldable error types. The diagnostic suggests yielding the error directly instead of wrapping it with `Effect.fail()`, as yieldable errors (like `Data.TaggedError` and `Schema.TaggedError`) can be yielded directly in Effect generators.

  Example:

  ```typescript
  // ❌ Unnecessary Effect.fail wrapper
  yield * Effect.fail(new DataTaggedError());

  // ✅ Direct yield of yieldable error
  yield * new DataTaggedError();
  ```

## 0.56.0

### Minor Changes

- [#494](https://github.com/Effect-TS/language-service/pull/494) [`9b3edf0`](https://github.com/Effect-TS/language-service/commit/9b3edf0ddc18f5a1fc697aa1d5a6bf4cc9431d19) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `codegen` CLI command to automatically update Effect codegens

  This release introduces a new CLI command `effect-language-service codegen` that allows you to automatically update Effect codegens in your TypeScript files from the command line. The command scans files containing `@effect-codegens` directives and applies the necessary code transformations.

  **Usage:**

  - `effect-language-service codegen --file <path>` - Update a specific file
  - `effect-language-service codegen --project <tsconfig.json>` - Update all files in a project
  - `effect-language-service codegen --verbose` - Show detailed output during processing

  **Example:**

  ```bash
  # Update a single file
  effect-language-service codegen --file src/MyService.ts

  # Update entire project
  effect-language-service codegen --project tsconfig.json --verbose
  ```

  This is particularly useful for CI/CD pipelines or batch processing scenarios where you want to ensure all codegens are up-to-date without manual editor intervention.

## 0.55.5

### Patch Changes

- [#492](https://github.com/Effect-TS/language-service/pull/492) [`f2d2748`](https://github.com/Effect-TS/language-service/commit/f2d27489164b12fede92c31a50a8d07cf56e28cf) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fixed duplicate edges in layer outline graph that could occur when multiple type assignments matched between layer nodes

## 0.55.4

### Patch Changes

- [#490](https://github.com/Effect-TS/language-service/pull/490) [`7d2e6dc`](https://github.com/Effect-TS/language-service/commit/7d2e6dc5ccd8bc8c71fafaba86d0af68103ae1ab) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Optimize `getTypeAtLocation` usage to reduce unnecessary calls on non-expression nodes. This improves performance by ensuring type checking is only performed on expression nodes and adds additional null safety checks for symbol resolution.

## 0.55.3

### Patch Changes

- [#488](https://github.com/Effect-TS/language-service/pull/488) [`53eedea`](https://github.com/Effect-TS/language-service/commit/53eedeadae97401defa148d4db560aca1d84da0a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fixed `@effect-diagnostics-next-line` comment directive to properly work with diagnostics on property assignments within object literals. Previously, the directive would not suppress diagnostics for properties in the middle of an object literal.

- [#486](https://github.com/Effect-TS/language-service/pull/486) [`3830d48`](https://github.com/Effect-TS/language-service/commit/3830d481c152ffd40dcab9d9805e20b2bf517a95) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fixed quick info feature to properly display Effect type parameters when hovering over code. This resolves issues where the quick info would fail to show Success, Failure, and Requirements types in certain contexts.

- [#489](https://github.com/Effect-TS/language-service/pull/489) [`42ce900`](https://github.com/Effect-TS/language-service/commit/42ce90061927905296371ea3c2d292511a2c2538) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow to override Schema constructor as long parameters are just redirected

## 0.55.2

### Patch Changes

- [#484](https://github.com/Effect-TS/language-service/pull/484) [`7c18fa8`](https://github.com/Effect-TS/language-service/commit/7c18fa8b08c6e6cf0914a3ac140c8e9710868eb5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix edge cases in missedPipeableOpportunity diagnostic where it incorrectly flagged valid code patterns. The diagnostic now properly:
  - Excludes `pipe` function calls from chain detection
  - Ignores chains where the function returns a callable type (avoiding false positives for higher-order functions like `Schedule.whileOutput`)

## 0.55.1

### Patch Changes

- [#482](https://github.com/Effect-TS/language-service/pull/482) [`9695bdf`](https://github.com/Effect-TS/language-service/commit/9695bdfec4412569150a5332405a1ec16b4fa085) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix `missedPipeableOpportunity` diagnostic to correctly detect nested function call chains

  The diagnostic now properly identifies when nested function calls can be converted to pipeable style. Previously, the chain detection logic incorrectly tracked parent-child relationships, causing false positives. This fix ensures that only valid pipeable chains are reported, such as `toString(double(addOne(5)))` which can be refactored to `addOne(5).pipe(double, toString)`.

  Example:

  ```typescript
  // Before: incorrectly flagged or missed
  identity(Schema.decodeUnknown(MyStruct)({ x: 42, y: 42 }));

  // After: correctly handles complex nested calls
  toString(double(addOne(5))); // ✓ Now correctly detected as pipeable
  ```

## 0.55.0

### Minor Changes

- [#478](https://github.com/Effect-TS/language-service/pull/478) [`9a9d5f9`](https://github.com/Effect-TS/language-service/commit/9a9d5f9486df177dd2e9d9cf63e97569b0436de0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `runEffectInsideEffect` diagnostic to warn when using `Effect.runSync`, `Effect.runPromise`, `Effect.runFork`, or `Effect.runCallback` inside an Effect context (such as `Effect.gen`, `Effect.fn`, or `Effect.fnUntraced`).

  Running effects inside effects is generally not recommended as it breaks the composability of the Effect system. Instead, developers should extract the Runtime and use `Runtime.runSync`, `Runtime.runPromise`, etc., or restructure their code to avoid running effects inside effects.

  Example:

  ```typescript
  // ❌ Will trigger diagnostic
  export const program = Effect.gen(function* () {
    const data = yield* Effect.succeed(42);
    const result = Effect.runSync(Effect.sync(() => data * 2)); // Not recommended
    return result;
  });

  // ✅ Proper approach - extract runtime
  export const program = Effect.gen(function* () {
    const data = yield* Effect.succeed(42);
    const runtime = yield* Effect.runtime();
    const result = Runtime.runSync(runtime)(Effect.sync(() => data * 2));
    return result;
  });

  // ✅ Better approach - compose effects
  export const program = Effect.gen(function* () {
    const data = yield* Effect.succeed(42);
    const result = yield* Effect.sync(() => data * 2);
    return result;
  });
  ```

- [#480](https://github.com/Effect-TS/language-service/pull/480) [`f1a0ece`](https://github.com/Effect-TS/language-service/commit/f1a0ece931826bd40c35118833b3be2ae6c90ab7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `schemaUnionOfLiterals` diagnostic to warn when using `Schema.Union` with multiple `Schema.Literal` calls that can be simplified to a single `Schema.Literal` call.

  This diagnostic helps improve code readability and maintainability by suggesting a more concise syntax for union of literals.

  Example:

  ```typescript
  // ❌ Will trigger diagnostic
  export const Status = Schema.Union(Schema.Literal("A"), Schema.Literal("B"));

  // ✅ Simplified approach
  export const Status = Schema.Literal("A", "B");
  ```

### Patch Changes

- [#481](https://github.com/Effect-TS/language-service/pull/481) [`160e018`](https://github.com/Effect-TS/language-service/commit/160e018c6f2eef21d537cc5e4f2666a43beb4724) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Update Effect ecosystem dependencies to latest versions:

  - `@effect/cli`: 0.71.0 → 0.72.0
  - `@effect/platform`: 0.92.1 → 0.93.0
  - `@effect/platform-node`: 0.98.3 → 0.99.0
  - `@effect/printer-ansi`: 0.46.0 → 0.47.0
  - `@effect/rpc`: 0.71.0 → 0.72.0
  - `effect`: Updated to stable version 3.19.0

  Also updated development tooling dependencies:

  - `vitest`: 3.2.4 → 4.0.6
  - `@vitest/coverage-v8`: 3.2.4 → 4.0.6
  - TypeScript ESLint packages: 8.46.1 → 8.46.3
  - Various other minor dependency updates

## 0.54.0

### Minor Changes

- [#476](https://github.com/Effect-TS/language-service/pull/476) [`9d5028c`](https://github.com/Effect-TS/language-service/commit/9d5028c92cdde20a881a30f5e3d25cc2c18741bc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `unknownInEffectCatch` diagnostic to warn when catch callbacks in `Effect.tryPromise`, `Effect.tryMap`, or `Effect.tryMapPromise` return `unknown` or `any` types. This helps ensure proper error typing by encouraging developers to wrap unknown errors into Effect's `Data.TaggedError` or narrow down the type to the specific error being raised.

  Example:

  ```typescript
  // ❌ Will trigger diagnostic
  const program = Effect.tryPromise({
    try: () => fetch("http://something"),
    catch: (e) => e, // returns unknown
  });

  // ✅ Proper typed error
  class MyError extends Data.TaggedError("MyError")<{ cause: unknown }> {}

  const program = Effect.tryPromise({
    try: () => fetch("http://something"),
    catch: (e) => new MyError({ cause: e }),
  });
  ```

### Patch Changes

- [#475](https://github.com/Effect-TS/language-service/pull/475) [`9f2425e`](https://github.com/Effect-TS/language-service/commit/9f2425e65e72099fba1e78948578a5e0b8598873) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix TSC patching mode to properly filter diagnostics by module name. The `reportSuggestionsAsWarningsInTsc` option now only affects the TSC module and not the TypeScript module, preventing suggestions from being incorrectly reported in non-TSC contexts.

## 0.53.3

### Patch Changes

- [#473](https://github.com/Effect-TS/language-service/pull/473) [`b29eca5`](https://github.com/Effect-TS/language-service/commit/b29eca54ae90283887e0f8c586c62e49a3b13737) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix memory leak in CLI diagnostics by properly disposing language services when they change between batches.

  The CLI diagnostics command now tracks the language service instance and disposes of it when a new instance is created, preventing memory accumulation during batch processing of large codebases.

- [#474](https://github.com/Effect-TS/language-service/pull/474) [`06b9ac1`](https://github.com/Effect-TS/language-service/commit/06b9ac143919cabd0f8a4836487f583c09772081) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix TSC patching mode to properly enable diagnosticsName option and simplify suggestion handling.

  When using the language service in TSC patching mode, the `diagnosticsName` option is now automatically enabled to ensure diagnostic rule names are included in the output. Additionally, the handling of suggestion-level diagnostics has been simplified - when `reportSuggestionsAsWarningsInTsc` is enabled, suggestions are now converted to Message category instead of Warning category with a prefix.

  This change ensures consistent diagnostic formatting across both IDE and CLI usage modes.

- [#471](https://github.com/Effect-TS/language-service/pull/471) [`be70748`](https://github.com/Effect-TS/language-service/commit/be70748806682d9914512d363df05a0366fa1c56) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve CLI diagnostics output formatting by displaying rule names in a more readable format.

  The CLI now displays diagnostic rule names using the format `effect(ruleName):` instead of `TS<code>:`, making it easier to identify which Effect diagnostic rule triggered the error. Additionally, the CLI now disables the `diagnosticsName` option internally to prevent duplicate rule name display in the message text.

  Example output:

  ```
  Before: TS90001: Floating Effect detected...
  After:  effect(floatingEffect): Floating Effect detected...
  ```

## 0.53.2

### Patch Changes

- [#469](https://github.com/Effect-TS/language-service/pull/469) [`f27be56`](https://github.com/Effect-TS/language-service/commit/f27be56a61413f7b79d8778af59b54399381ba8d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `reportSuggestionsAsWarningsInTsc` configuration option to allow suggestions and messages to be reported as warnings in TypeScript compiler.

  When enabled, diagnostics with "suggestion" or "message" severity will be upgraded to "warning" severity with a "[suggestion]" prefix in the message text. This is useful for CI/CD pipelines where you want to enforce suggestion-level diagnostics as warnings in the TypeScript compiler output.

  Example configuration:

  ```json
  {
    "compilerOptions": {
      "plugins": [
        {
          "name": "@effect/language-service",
          "reportSuggestionsAsWarningsInTsc": true
        }
      ]
    }
  }
  ```

## 0.53.1

### Patch Changes

- [#467](https://github.com/Effect-TS/language-service/pull/467) [`c2f6e50`](https://github.com/Effect-TS/language-service/commit/c2f6e5036b3b248201d855c61e2b206c3b8ed20d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix layer graph display improvements: properly render newlines in mermaid diagrams using `<br/>` tags, and improve readability by displaying variable declaration names instead of full expressions when available.

  Example: Instead of showing the entire `pipe(Database.Default, Layer.provideMerge(UserRepository.Default))` expression in the graph node, it now displays the cleaner variable name `AppLive` when the layer is assigned to a variable.

## 0.53.0

### Minor Changes

- [#466](https://github.com/Effect-TS/language-service/pull/466) [`e76e9b9`](https://github.com/Effect-TS/language-service/commit/e76e9b90454de68cbf6e025ab63ecce5464168f3) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for following symbols in Layer Graph visualization

  The layer graph feature now supports following symbol references to provide deeper visualization of layer dependencies. This is controlled by the new `layerGraphFollowDepth` configuration option (default: 0).

  Example:

  ```typescript
  // With layerGraphFollowDepth: 1
  export const myLayer = otherLayer.pipe(Layer.provide(DbConnection.Default));
  // Now visualizes the full dependency tree by following the 'otherLayer' reference
  ```

### Patch Changes

- [#464](https://github.com/Effect-TS/language-service/pull/464) [`4cbd549`](https://github.com/Effect-TS/language-service/commit/4cbd5499a5edd93cc70e77695163cbb50ad9e63e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix layer graph for expression nodes not returning layers directly

## 0.52.1

### Patch Changes

- [#462](https://github.com/Effect-TS/language-service/pull/462) [`4931bbd`](https://github.com/Effect-TS/language-service/commit/4931bbd5d421b2b80bd0bc9eff71bd401b24f291) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Skip patching again by default, unless --force option is provided

## 0.52.0

### Minor Changes

- [#460](https://github.com/Effect-TS/language-service/pull/460) [`1ac81a0`](https://github.com/Effect-TS/language-service/commit/1ac81a0edb3fa98ffe90f5e8044d5d65de1f0027) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new diagnostic `catchUnfailableEffect` to warn when using catch functions on effects that never fail

  This diagnostic detects when catch error handling functions are applied to effects that have a `never` error type (meaning they cannot fail). It supports all Effect catch variants:

  - `Effect.catchAll`
  - `Effect.catch`
  - `Effect.catchIf`
  - `Effect.catchSome`
  - `Effect.catchTag`
  - `Effect.catchTags`

  Example:

  ```typescript
  // Will trigger diagnostic
  const example = Effect.succeed(42).pipe(
    Effect.catchAll(() => Effect.void) // <- Warns here
  );

  // Will not trigger diagnostic
  const example2 = Effect.fail("error").pipe(
    Effect.catchAll(() => Effect.succeed(42))
  );
  ```

  The diagnostic works in both pipeable style (`Effect.succeed(x).pipe(Effect.catchAll(...))`) and data-first style (`pipe(Effect.succeed(x), Effect.catchAll(...))`), analyzing the error type at each position in the pipe chain.

- [#458](https://github.com/Effect-TS/language-service/pull/458) [`372a9a7`](https://github.com/Effect-TS/language-service/commit/372a9a767bf69f733d54ab93e47eb4792e87b289) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor TypeParser internals to use symbol-based navigation instead of type-based navigation

  This change improves the reliability and performance of the TypeParser by switching from type-based navigation to symbol-based navigation when identifying Effect, Schema, and other Effect ecosystem APIs. The new implementation:

  - Uses TypeScript's symbol resolution APIs to accurately identify imports and references
  - Supports package name resolution to verify that identifiers actually reference the correct packages
  - Implements proper alias resolution for imported symbols
  - Adds caching for source file package information lookups
  - Provides new helper methods like `isNodeReferenceToEffectModuleApi` and `isNodeReferenceToEffectSchemaModuleApi`

  This is an internal refactoring that doesn't change the public API or functionality, but provides a more robust foundation for the language service features.

## 0.51.1

### Patch Changes

- [#456](https://github.com/Effect-TS/language-service/pull/456) [`ddc3da8`](https://github.com/Effect-TS/language-service/commit/ddc3da8771f614aa2391f8753b44c6dad787bbd4) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Bug fix for layer graph: properly display dependencies when they reference themselves

  The layer graph now correctly identifies and displays dependencies even when using type assignment compatibility (e.g., when a layer provides a base type and another layer requires a subtype).

## 0.51.0

### Minor Changes

- [#452](https://github.com/Effect-TS/language-service/pull/452) [`fb0ae8b`](https://github.com/Effect-TS/language-service/commit/fb0ae8bf7b8635c791a085022b51bf1a914c0b46) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `strictEffectProvide` diagnostic to warn when using Effect.provide with Layer outside of application entry points

  This new diagnostic helps developers identify potential scope lifetime issues by detecting when `Effect.provide` is called with a Layer argument in locations that are not application entry points.

  **Example:**

  ```typescript
  // Will trigger diagnostic
  export const program = Effect.void.pipe(Effect.provide(MyService.Default));
  ```

  **Message:**

  > Effect.provide with a Layer should only be used at application entry points. If this is an entry point, you can safely disable this diagnostic. Otherwise, using Effect.provide may break scope lifetimes. Compose all layers at your entry point and provide them at once.

  **Configuration:**

  - **Default severity**: `"off"` (opt-in)
  - **Diagnostic name**: `strictEffectProvide`

  This diagnostic is disabled by default and can be enabled via tsconfig.json:

  ```json
  {
    "compilerOptions": {
      "plugins": [
        {
          "name": "@effect/language-service",
          "diagnosticSeverity": {
            "strictEffectProvide": "warning"
          }
        }
      ]
    }
  }
  ```

### Patch Changes

- [#455](https://github.com/Effect-TS/language-service/pull/455) [`11743b5`](https://github.com/Effect-TS/language-service/commit/11743b5144cf5189ae2fce554113688c56ce6b9c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Bug fix for `missedPipeableOpportunity` diagnostic

## 0.50.0

### Minor Changes

- [#450](https://github.com/Effect-TS/language-service/pull/450) [`3994aaf`](https://github.com/Effect-TS/language-service/commit/3994aafb7dbf5499e5d1d7177eca7135c5a02a51) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new diagnostic to detect nested function calls that can be converted to pipeable style

  The new `missedPipeableOpportunity` diagnostic identifies nested function calls that would be more readable when converted to Effect's pipeable style. For example:

  ```ts
  // Detected pattern:
  toString(double(addOne(5)));

  // Can be converted to:
  addOne(5).pipe(double, toString);
  ```

  This diagnostic helps maintain consistent code style and improves readability by suggesting the more idiomatic pipeable approach when multiple functions are chained together.

## 0.49.0

### Minor Changes

- [#445](https://github.com/Effect-TS/language-service/pull/445) [`fe0e390`](https://github.com/Effect-TS/language-service/commit/fe0e390f02d12f959966d651bfec256c4f313ffb) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Use the Graph module for outline line graph and layer magic

### Patch Changes

- [#449](https://github.com/Effect-TS/language-service/pull/449) [`ff11b7d`](https://github.com/Effect-TS/language-service/commit/ff11b7da9b55a3da91131c4b5932c93c6af71fc8) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Update effect package version to 97ff1dc. This version improves handling of special characters in layer graph mermaid diagrams by properly escaping HTML entities (parentheses, braces, quotes) to ensure correct rendering.

## 0.48.0

### Minor Changes

- [#441](https://github.com/Effect-TS/language-service/pull/441) [`ed1db9e`](https://github.com/Effect-TS/language-service/commit/ed1db9ef2432d9d94df80e1835eb42491f0cfbf2) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `default-hashed` pattern for deterministic keys

  A new `default-hashed` pattern option is now available for service and error key patterns. This pattern works like the `default` pattern but hashes the resulting string, which is useful when you want deterministic keys but are concerned about potentially exposing service names in builds.

  Example configuration:

  ```json
  {
    "keyPatterns": [
      { "target": "service", "pattern": "default-hashed" },
      { "target": "error", "pattern": "default-hashed" }
    ]
  }
  ```

### Patch Changes

- [#442](https://github.com/Effect-TS/language-service/pull/442) [`44f4304`](https://github.com/Effect-TS/language-service/commit/44f43041ced08ef1e6e6242baccbc855e056dfa7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Tone down try/catch message to ignore try/finally blocks

- [#439](https://github.com/Effect-TS/language-service/pull/439) [`b73c231`](https://github.com/Effect-TS/language-service/commit/b73c231dc13fc2db31eaeb3475a129cdeeca21dc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix regression in type unification for union types and prevent infinite recursion in layerMagic refactor

  - Fixed `toggleTypeAnnotation` refactor to properly unify boolean types instead of expanding them to `true | false`
  - Fixed infinite recursion issue in `layerMagic` refactor's `adjustedNode` function when processing variable and property declarations

## 0.47.3

### Patch Changes

- [#437](https://github.com/Effect-TS/language-service/pull/437) [`e583192`](https://github.com/Effect-TS/language-service/commit/e583192cf73404da7c777f1e7fafd2d6ed968a96) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - In toggle return type refactors, skip type parameters if they are the same as the function default in some cases.

## 0.47.2

### Patch Changes

- [#433](https://github.com/Effect-TS/language-service/pull/433) [`f359cdb`](https://github.com/Effect-TS/language-service/commit/f359cdb1069b03b978259dac74c1ba209dd26ae6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve memory by properly evicting older cached members

## 0.47.1

### Patch Changes

- [#431](https://github.com/Effect-TS/language-service/pull/431) [`acbbc55`](https://github.com/Effect-TS/language-service/commit/acbbc55f30a4223a14623d69b2b3097c74644647) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix nested project references relative paths in CLI diagnostics command

  The CLI diagnostics command now correctly resolves paths for nested project references by:

  - Using absolute paths when parsing tsconfig files
  - Correctly resolving the base directory for relative paths in project references
  - Processing files in batches to improve memory usage and prevent leaks

## 0.47.0

### Minor Changes

- [#429](https://github.com/Effect-TS/language-service/pull/429) [`351d7fb`](https://github.com/Effect-TS/language-service/commit/351d7fbec1158294f6cf309eafdb99f5260de8d5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new `diagnostics` CLI command to check Effect-specific diagnostics for files or projects

  The new `effect-language-service diagnostics` command provides a way to get Effect-specific diagnostics through the CLI without patching your TypeScript installation. It supports:

  - `--file` option to get diagnostics for a specific file
  - `--project` option with a tsconfig file to check an entire project

  The command outputs diagnostics in the same format as the TypeScript compiler, showing errors, warnings, and messages with their locations and descriptions.

## 0.46.0

### Minor Changes

- [#424](https://github.com/Effect-TS/language-service/pull/424) [`4bbfdb0`](https://github.com/Effect-TS/language-service/commit/4bbfdb0a4894ee442e93b0a6cfa845447a2a045f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support to mark a service as "leakable" via JSDoc tag. Services marked with `@effect-leakable-service` will be excluded from the leaking requirements diagnostic, allowing requirements that are expected to be provided per method invocation (e.g. HttpServerRequest).

  Example:

  ```ts
  /**
   * @effect-leakable-service
   */
  export class FileSystem extends Context.Tag("FileSystem")<
    FileSystem,
    {
      writeFile: (content: string) => Effect.Effect<void>;
    }
  >() {}
  ```

- [#428](https://github.com/Effect-TS/language-service/pull/428) [`ebaa8e8`](https://github.com/Effect-TS/language-service/commit/ebaa8e85d1c372fb3f584a49b6ea3600c467ac33) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add diagnostic to warn when `@effect-diagnostics-next-line` comments have no effect. This helps identify unused suppression comments that don't actually suppress any diagnostics, improving code cleanliness.

  The new `missingDiagnosticNextLine` option controls the severity of this diagnostic (default: "warning"). Set to "off" to disable.

  Example:

  ```ts
  // This comment will trigger a warning because it doesn't suppress any diagnostic
  // @effect-diagnostics-next-line effect/floatingEffect:off
  const x = 1;

  // This comment is correctly suppressing a diagnostic
  // @effect-diagnostics-next-line effect/floatingEffect:off
  Effect.succeed(1);
  ```

### Patch Changes

- [#426](https://github.com/Effect-TS/language-service/pull/426) [`22717bd`](https://github.com/Effect-TS/language-service/commit/22717bda12a889f00bc4b78719a487e62da74bef) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve Layer Magic refactor with enhanced dependency sorting and cycle detection

  The Layer Magic refactor now includes:

  - Better handling of complex layer composition scenarios
  - Support for detecting missing layer implementations with helpful error messages

## 0.45.1

### Patch Changes

- [#423](https://github.com/Effect-TS/language-service/pull/423) [`70d8734`](https://github.com/Effect-TS/language-service/commit/70d8734558c4ba3abfd69fafce785b7f58a70a52) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add code fix to rewrite Schema class constructor overrides as static 'new' methods

  When detecting constructor overrides in Schema classes, the diagnostic now provides a new code fix option that automatically rewrites the constructor as a static 'new' method. This preserves the custom initialization logic while maintaining Schema's decoding behavior.

  Example:

  ```typescript
  // Before (with constructor override)
  class MyClass extends Schema.Class<MyClass>("MyClass")({ a: Schema.Number }) {
    b: number;
    constructor() {
      super({ a: 42 });
      this.b = 56;
    }
  }

  // After (using static 'new' method)
  class MyClass extends Schema.Class<MyClass>("MyClass")({ a: Schema.Number }) {
    b: number;
    public static new() {
      const _this = new this({ a: 42 });
      _this.b = 56;
      return _this;
    }
  }
  ```

- [#421](https://github.com/Effect-TS/language-service/pull/421) [`8c455ed`](https://github.com/Effect-TS/language-service/commit/8c455ed7a459665d26c30f1e5d90338e48794815) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Update dependencies to their latest versions including Effect 3.18.4, TypeScript 5.9.3, and various ESLint and build tooling packages

## 0.45.0

### Minor Changes

- [#419](https://github.com/Effect-TS/language-service/pull/419) [`7cd7216`](https://github.com/Effect-TS/language-service/commit/7cd7216abc8e3057098acf1889c7494d17a869d6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for custom APIs in deterministicKeys diagnostic using the `@effect-identifier` JSDoc tag.

  You can now enforce deterministic keys in custom APIs that follow an `extends MyApi("identifier")` pattern by:

  - Adding `extendedKeyDetection: true` to plugin options to enable detection
  - Marking the identifier parameter with `/** @effect-identifier */` JSDoc tag

  Example:

  ```ts
  export function Repository(/** @effect-identifier */ identifier: string) {
    return Context.Tag("Repository/" + identifier);
  }

  export class UserRepo extends Repository("user-repo")<
    UserRepo,
    {
      /** ... */
    }
  >() {}
  ```

## 0.44.1

### Patch Changes

- [#417](https://github.com/Effect-TS/language-service/pull/417) [`db0a643`](https://github.com/Effect-TS/language-service/commit/db0a6433d1bd9fed80d1e5b5bc7c3e18c9d82354) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix early exit for a deterministicKeys rule

## 0.44.0

### Minor Changes

- [#415](https://github.com/Effect-TS/language-service/pull/415) [`42c66a1`](https://github.com/Effect-TS/language-service/commit/42c66a12658d712671b482fdcce0c5b608171d4f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `diagnosticsName` option to include rule names in diagnostic messages. When enabled (default: true), diagnostic messages will display the rule name at the end, e.g., "Effect must be yielded or assigned to a variable. effect(floatingEffect)"

## 0.43.2

### Patch Changes

- [#410](https://github.com/Effect-TS/language-service/pull/410) [`0b40c04`](https://github.com/Effect-TS/language-service/commit/0b40c04625cadc0a8dfc3b194daafea1f751a3b9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Defer typescript loading in CLI

## 0.43.1

### Patch Changes

- [#408](https://github.com/Effect-TS/language-service/pull/408) [`9ccd800`](https://github.com/Effect-TS/language-service/commit/9ccd8007b338e0524e17d3061acb722ad5c0e87b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix handling of leading/trailing slashes

## 0.43.0

### Minor Changes

- [#407](https://github.com/Effect-TS/language-service/pull/407) [`6590590`](https://github.com/Effect-TS/language-service/commit/6590590c0decd83f0baa4fd47655f0f67b6c5db9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add deterministicKeys diagnostic to enforce consistent key patterns for Services and Errors

  This new diagnostic helps maintain consistent and unique keys for Effect Services and Tagged Errors by validating them against configurable patterns. The diagnostic is disabled by default and can be enabled via the `deterministicKeys` diagnosticSeverity setting.

  Two patterns are supported:

  - `default`: Constructs keys from package name + file path + class identifier (e.g., `@effect/package/FileName/ClassIdentifier`)
  - `package-identifier`: Uses package name + identifier for flat project structures

  Example configuration:

  ```jsonc
  {
    "diagnosticSeverity": {
      "deterministicKeys": "error"
    },
    "keyPatterns": [
      {
        "target": "service",
        "pattern": "default",
        "skipLeadingPath": ["src/"]
      }
    ]
  }
  ```

  The diagnostic also provides auto-fix code actions to update keys to match the configured patterns.

### Patch Changes

- [#405](https://github.com/Effect-TS/language-service/pull/405) [`f43b3ab`](https://github.com/Effect-TS/language-service/commit/f43b3ab32cad347fb2eb0af740771e35a6c7ff66) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix wrapWithEffectGen refactor not working on class heritage clauses

  The wrapWithEffectGen refactor now correctly skips expressions in heritage clauses (e.g., `extends` clauses in class declarations) to avoid wrapping them inappropriately.

## 0.42.0

### Minor Changes

- [#403](https://github.com/Effect-TS/language-service/pull/403) [`dc3f7e9`](https://github.com/Effect-TS/language-service/commit/dc3f7e90fad5743d7d47593221137908130f2f6e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `quickinfoMaximumLength` option to control the maximum length of types displayed in quickinfo hover. This helps improve performance when dealing with very long types by allowing TypeScript to truncate them to a specified budget. Defaults to -1 (no truncation), but can be set to any positive number (e.g., 1000) to limit type display length.

## 0.41.1

### Patch Changes

- [#401](https://github.com/Effect-TS/language-service/pull/401) [`394fa8d`](https://github.com/Effect-TS/language-service/commit/394fa8d2e8077a7788c446f876d0c162640e88f9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add Effect.Tag completion for classes extending Effect

  When typing `Effect.` in a class that extends Effect, the completion now also suggests `Effect.Tag` alongside the existing `Effect.Service` completion. This provides an additional way to define tagged services using the Effect.Tag pattern.

- [#398](https://github.com/Effect-TS/language-service/pull/398) [`ae323d7`](https://github.com/Effect-TS/language-service/commit/ae323d791e790019fdb155c67da3196622b5210d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor internal TypeScript API wrappers to TypeScriptApi module for better code organization

- [#400](https://github.com/Effect-TS/language-service/pull/400) [`6537461`](https://github.com/Effect-TS/language-service/commit/6537461915529e356f89a844755cc14f66349265) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Reuse program package json info cache if available

## 0.41.0

### Minor Changes

- [#396](https://github.com/Effect-TS/language-service/pull/396) [`744de40`](https://github.com/Effect-TS/language-service/commit/744de4072f713e31157cd082a7fef8695bb8c7c0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new diagnostic to warn when `Effect.Service` is used with a primitive type instead of an object type. This diagnostic helps prevent common mistakes where developers try to use primitive values (strings, numbers, etc.) as service types, which is not supported by `Effect.Service`. The diagnostic suggests wrapping the value in an object or manually using `Context.Tag` or `Effect.Tag` for primitive types.

## 0.40.1

### Patch Changes

- [#393](https://github.com/Effect-TS/language-service/pull/393) [`0d49098`](https://github.com/Effect-TS/language-service/commit/0d490981d77f31f600d3db49c214b9e7245ec3fa) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix name of autofix suggestion

- [#387](https://github.com/Effect-TS/language-service/pull/387) [`7307ee1`](https://github.com/Effect-TS/language-service/commit/7307ee1d01196eece482644ab9b8d68c19f2e692) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Comply with ts-patch and vue-tsc patching mechanism

- [#392](https://github.com/Effect-TS/language-service/pull/392) [`9df4e59`](https://github.com/Effect-TS/language-service/commit/9df4e59f6605ed95410c27bca3194a802e89422c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Adds override keyword in generated accessors

- [#395](https://github.com/Effect-TS/language-service/pull/395) [`e504cec`](https://github.com/Effect-TS/language-service/commit/e504cecb4ca5c0a82db5fb6893a025959dd16640) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix and silently skip double-adding of handlers in protocols handlers

## 0.40.0

### Minor Changes

- [#384](https://github.com/Effect-TS/language-service/pull/384) [`62b9829`](https://github.com/Effect-TS/language-service/commit/62b98290c043dc3457d116a92d91aaf57bde60fc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new diagnostic: `effectGenUsesAdapter` - warns when using `Effect.gen` with the generator adapter pattern (function\*(\_)) instead of using `pipe()`

  The generator adapter pattern `function*(_)` is an old pattern. Users should use `pipe()` for composing effects or `Effect.gen(function*())` without the adapter for generator-based code.

  Example that will trigger the warning:

  ```ts
  const example = Effect.gen(function* (_) {
    const result = yield* _(Effect.succeed(42));
    return result;
  });
  ```

### Patch Changes

- [#382](https://github.com/Effect-TS/language-service/pull/382) [`2f318b6`](https://github.com/Effect-TS/language-service/commit/2f318b6af86bb9e81fcc806f180bf149712e027d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add noExternal option

- [#385](https://github.com/Effect-TS/language-service/pull/385) [`8580bed`](https://github.com/Effect-TS/language-service/commit/8580bed2ee39b92c410a95c6651812519bd3d3bb) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix false positive regarding Schema.Class

## 0.39.0

### Minor Changes

- [#380](https://github.com/Effect-TS/language-service/pull/380) [`98e30dd`](https://github.com/Effect-TS/language-service/commit/98e30dd52b1f67aed10ae7d83b4833e6ff2bac19) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Added exposed APIs for mermaid chart locally and allow to disable external links

## 0.38.4

### Patch Changes

- [#378](https://github.com/Effect-TS/language-service/pull/378) [`2f9bc51`](https://github.com/Effect-TS/language-service/commit/2f9bc515d8c26bb2e6488d71308195d11965e14d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for Effect.Tag in writeTagClassAccessors refactor

  The writeTagClassAccessors refactor now supports Effect.Tag classes in addition to Effect.Service and Context.Tag. This allows users to generate accessor methods for services created with Effect.Tag, maintaining consistency across all tag-based service patterns.

## 0.38.3

### Patch Changes

- [#375](https://github.com/Effect-TS/language-service/pull/375) [`74696fd`](https://github.com/Effect-TS/language-service/commit/74696fda0300aa40fbb155a9967cb649c7f89595) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix `resolveModulePattern` to use fallback mechanism for package scope resolution when primary method is unavailable

## 0.38.2

### Patch Changes

- [#374](https://github.com/Effect-TS/language-service/pull/374) [`9d66c1e`](https://github.com/Effect-TS/language-service/commit/9d66c1eb1f67837166a01b3c7993620a520fe0a4) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix Mermaid graph generation for layers with generic types

  Properly escape angle brackets (`<` and `>`) in Mermaid diagrams to prevent rendering issues when displaying layer names containing generic type parameters.

- [#370](https://github.com/Effect-TS/language-service/pull/370) [`0e25fbc`](https://github.com/Effect-TS/language-service/commit/0e25fbc9ea6784d99eb6feacfdc976044b9c890c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Layer Magic refactor now shows previously provided layers as a comment in the generated type annotation.

  When using the Layer Magic "Prepare for reuse" refactor, layers that were already provided at the location are now shown as a trailing comment (e.g., `/* Foo | Bar */`) next to the newly introduced layer types. This helps developers understand which layers were already available and which ones are being newly introduced.

- [#372](https://github.com/Effect-TS/language-service/pull/372) [`172363c`](https://github.com/Effect-TS/language-service/commit/172363cdbfe8df9704a1fd85e77cf01d28b721e6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add general support for Effect.Tag in various diagnostics/refactors

## 0.38.1

### Patch Changes

- [#368](https://github.com/Effect-TS/language-service/pull/368) [`01f62a9`](https://github.com/Effect-TS/language-service/commit/01f62a99c53d5bc70242d858e3573dd9dffc54d7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix logic of firstChild with patching mode

## 0.38.0

### Minor Changes

- [#365](https://github.com/Effect-TS/language-service/pull/365) [`3b418c5`](https://github.com/Effect-TS/language-service/commit/3b418c58b8b337fd62f15bea21faca6465b9405a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add Layer Magic refactor for automatic layer composition and building

  This refactor allows you to automatically compose and build layers based on service dependencies. It helps simplify complex layer constructions by:

  - Analyzing service dependencies
  - Automatically composing layers in the correct order
  - Building final layer structures with proper dependency resolution

  Example: When working with services that have dependencies, the refactor can transform your layer setup code into a properly composed layer structure that respects all service requirements.

### Patch Changes

- [#367](https://github.com/Effect-TS/language-service/pull/367) [`0e6034b`](https://github.com/Effect-TS/language-service/commit/0e6034b0c5a9ee3967bd813b47c7b83a54b004f3) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add shebang to CLI entry point for proper executable support and bump version

## 0.37.0

### Minor Changes

- [#361](https://github.com/Effect-TS/language-service/pull/361) [`3834abe`](https://github.com/Effect-TS/language-service/commit/3834abe88ceda4bd26244df155bca777eec21a96) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add to patching mode support to storing metadata such as relation error locations and types to improve perf

- [#363](https://github.com/Effect-TS/language-service/pull/363) [`8fb54a9`](https://github.com/Effect-TS/language-service/commit/8fb54a9be92425940d1f61e207b9a272aeb20e65) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for importAliases config

### Patch Changes

- [#356](https://github.com/Effect-TS/language-service/pull/356) [`8c906e1`](https://github.com/Effect-TS/language-service/commit/8c906e1cf72f02056cdfe298804cfc95456de4ff) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add helper for renames, so that triggering a rename will include the identifier of a class as well

- [#360](https://github.com/Effect-TS/language-service/pull/360) [`331051d`](https://github.com/Effect-TS/language-service/commit/331051d66edc42def1f3250c02316a3652d680b0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Some minor perf improvements

- [#358](https://github.com/Effect-TS/language-service/pull/358) [`03cfa73`](https://github.com/Effect-TS/language-service/commit/03cfa73bc59943a60d2f75744497e5911089d049) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor TypeChecker utilities to improve code organization by moving utility functions from TypeCheckerApi.ts to TypeCheckerUtils.ts

- [#364](https://github.com/Effect-TS/language-service/pull/364) [`358f323`](https://github.com/Effect-TS/language-service/commit/358f3236156ee7b6222f941757f41853c23ebd25) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Replace direct `.text` property access with TypeScript API helper `ts.idText()` for getting identifier text from nodes. This is a more robust approach that properly handles escaped identifiers and follows TypeScript's recommended practices.

## 0.36.0

### Minor Changes

- [#354](https://github.com/Effect-TS/language-service/pull/354) [`b4b4657`](https://github.com/Effect-TS/language-service/commit/b4b4657585286db479d30ac41e2e5406a5cd0044) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add LSP patch mode

### Patch Changes

- [#353](https://github.com/Effect-TS/language-service/pull/353) [`790d4d0`](https://github.com/Effect-TS/language-service/commit/790d4d07e3934cbc6631b8fd856ee3179e11520e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix CLI and LSP improvements:

  - Remove deprecated check command from CLI
  - Fix unpatch command to default to both typescript and tsc modules when no modules specified
  - Add concatDiagnostics utility to prevent duplicate diagnostics in LSP

- [#351](https://github.com/Effect-TS/language-service/pull/351) [`be5d851`](https://github.com/Effect-TS/language-service/commit/be5d8515b7844d17841a5012c16cc64056aaf351) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix TypeScript module reference in patch utility to use correct module name when patching TypeScript directly

- [#349](https://github.com/Effect-TS/language-service/pull/349) [`46a1ef2`](https://github.com/Effect-TS/language-service/commit/46a1ef29c03579cbb05cd788daa27351e8b58bb8) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Introduce ts-patch less mode

## 0.35.2

### Patch Changes

- [#346](https://github.com/Effect-TS/language-service/pull/346) [`5a37be2`](https://github.com/Effect-TS/language-service/commit/5a37be23a137ac703018f70f70248caa8835e6bc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix auto-import barrel-to-barrel mapping for top-level named re-exports

  When `topLevelNamedReexports` is set to "follow", the auto-import provider now correctly maps barrel exports to their barrel modules, ensuring proper import suggestions for re-exported functions like `pipe` from `effect/Function`.

## 0.35.1

### Patch Changes

- [#345](https://github.com/Effect-TS/language-service/pull/345) [`92ee0ff`](https://github.com/Effect-TS/language-service/commit/92ee0ff4b05bc4aed38e8bd8662547c6aa4230db) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix async/await to Effect.gen.tryPromise and Effect.fn.tryPromise refactors to use Data.TaggedError for error handling instead of inline objects

- [#343](https://github.com/Effect-TS/language-service/pull/343) [`0570ccf`](https://github.com/Effect-TS/language-service/commit/0570ccf08df996ff67779c1407d50895ade159db) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix async/await to Effect.fn refactor to use correct function name

  Previously, the refactor would incorrectly use the function's own name instead of `Effect.fn` when transforming async functions. This patch fixes the issue to properly generate `Effect.fn("functionName")` in the refactored code.

## 0.35.0

### Minor Changes

- [#339](https://github.com/Effect-TS/language-service/pull/339) [`ef70757`](https://github.com/Effect-TS/language-service/commit/ef7075766afc39edd0ee0f9bb6bbfb55dbf9f11b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new refactors to transform async/await functions to Effect.fn

  - Transform an async function definition into an Effect by using Effect.fn
  - Transform an async function definition into an Effect by using Effect.fn with tagged errors for each promise call

  These refactors complement the existing Effect.gen refactors by providing an alternative transformation using Effect.fn.

### Patch Changes

- [#341](https://github.com/Effect-TS/language-service/pull/341) [`df65523`](https://github.com/Effect-TS/language-service/commit/df65523e79641028df40438f746d9ee999a5e771) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Revert to previous transform logic

## 0.34.0

### Minor Changes

- [#335](https://github.com/Effect-TS/language-service/pull/335) [`81a090a`](https://github.com/Effect-TS/language-service/commit/81a090a52fb4a2301d9387e0989313cc7fcdade9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add new diagnostic to warn when schema classes override the default constructor behavior

  The new diagnostic helps catch cases where schema classes define custom constructors that might break the expected schema behavior. Example:

  ```ts
  import { Schema } from "effect";

  class MySchema extends Schema.Class<MySchema>("MySchema")({
    value: Schema.String,
  }) {
    // This will trigger a warning
    constructor(props: { value: string }) {
      super(props);
    }
  }
  ```

  The diagnostic provides quickfixes to either:

  - Remove the constructor
  - Suppress the warning for the current line
  - Suppress the warning for the entire file

### Patch Changes

- [#337](https://github.com/Effect-TS/language-service/pull/337) [`d72b1b4`](https://github.com/Effect-TS/language-service/commit/d72b1b4e324f8075a9c2840bb097d8436938d03d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve `effectGenToFn` refactor to preserve function names

  The `effectGenToFn` refactor now extracts and preserves the original function name when converting from `Effect.gen` to `Effect.fn`. For example:

  ```typescript
  // Before refactor
  export const programWithPipes = (fa: number, fb: number) =>
    Eff.gen(
      function* () {
        const a = yield* Eff.succeed(fa);
        const b = yield* Eff.succeed(fb);
        return a + b;
      },
      Eff.map((a) => a + 1)
    );

  // After refactor (now preserves "programWithPipes" name)
  export const programWithPipes = Eff.fn("programWithPipes")(
    function* (fa: number, fb: number) {
      const a = yield* Eff.succeed(fa);
      const b = yield* Eff.succeed(fb);
      return a + b;
    },
    Eff.map((a) => a + 1)
  );
  ```

## 0.33.2

### Patch Changes

- [#331](https://github.com/Effect-TS/language-service/pull/331) [`d862c23`](https://github.com/Effect-TS/language-service/commit/d862c239f03cca679222f05cf2c9c49d0d57048d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix diagnostics not running for all source files in transform

  Previously, diagnostics were only running on the current file being transformed instead of all root files in the TypeScript program. This could cause some diagnostics to be missed during compilation.

  Also updated README with important notes about ts-patch limitations:

  - Effect diagnostics in watch mode with noEmit enabled are not supported
  - Incremental builds may require a full rebuild after enabling ts-patch to invalidate the previous diagnostics cache

## 0.33.1

### Patch Changes

- [#328](https://github.com/Effect-TS/language-service/pull/328) [`e25a3f9`](https://github.com/Effect-TS/language-service/commit/e25a3f9bcaa0c3c4c0a06ddef7fe4c42d7a85f0f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - feat: add inlay hints for Effect.gen-like middleware functions

  Improved inlay hints for Effect.gen-like middleware functions to reduce visual clutter by omitting redundant type annotations that TypeScript already provides.

## 0.33.0

### Minor Changes

- [#327](https://github.com/Effect-TS/language-service/pull/327) [`52de365`](https://github.com/Effect-TS/language-service/commit/52de365b445c2985c0c8755ddc59e814f423b716) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for inlay hints in Effect.gen-like middleware functions

  This feature provides TypeScript inlay hints for generator functions used with Effect.gen, Effect.fn.gen, and Effect.fn.untraced.gen. When enabled, it shows the inferred return type directly in the editor, making it easier to understand the types without hovering over the function.

  Example:

  ```typescript
  const myEffect = Effect.gen(function* () /* : Effect<number> */ {
    yield* Effect.succeed(42);
  });
  ```

- [#325](https://github.com/Effect-TS/language-service/pull/325) [`cbea35a`](https://github.com/Effect-TS/language-service/commit/cbea35ac302cc914f193af21cc2a8bb1aef57d48) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `quickinfoEffectParameters` configuration option to control when Effect type parameters are displayed in quickinfo

  This new option allows users to configure when Effect type parameters are shown in hover information:

  - `"always"`: Always show type parameters
  - `"never"`: Never show type parameters
  - `"whenTruncated"` (default): Only show when TypeScript truncates the type display

  Example configuration:

  ```json
  {
    "effectLanguageService": {
      "quickinfoEffectParameters": "whenTruncated"
    }
  }
  ```

## 0.32.0

### Minor Changes

- [#323](https://github.com/Effect-TS/language-service/pull/323) [`b584cde`](https://github.com/Effect-TS/language-service/commit/b584cde5a83e8eb2042f02ba4f346416e37528b9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Added support for `topLevelNamedReexports` configuration option to control how top-level named re-exports are handled when using `namespaceImportPackages`.

  - `"ignore"` (default): Named re-exports like `import { pipe } from "effect"` are left as-is
  - `"follow"`: Named re-exports are rewritten to their original module, e.g., `import { pipe } from "effect/Function"`

  This allows users to have more control over their import style preferences when using namespace imports.

### Patch Changes

- [#321](https://github.com/Effect-TS/language-service/pull/321) [`022956a`](https://github.com/Effect-TS/language-service/commit/022956a80203e694078b3b3a38fe8fda9ac35b3a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve diagnostic message for missingReturnYieldStar to better explain why return yield\* is recommended for Effects that never succeed

- [#324](https://github.com/Effect-TS/language-service/pull/324) [`8271284`](https://github.com/Effect-TS/language-service/commit/8271284dacd021d7d332d2e8e1623846f7535ffa) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve floating effect diagnostic message to specify the actual type being flagged. When detecting floating Stream or other Effect subtypes, the error message now shows "Effect-able Stream<...>" instead of just "Effect", making it clearer what type needs to be handled.

## 0.31.2

### Patch Changes

- [#318](https://github.com/Effect-TS/language-service/pull/318) [`9928704`](https://github.com/Effect-TS/language-service/commit/9928704d88a38bba9d42d813cd3e3464a6e1b0c4) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve missing Effect service dependency diagnostic

  - Enhanced TypeParser to better handle service dependencies detection
  - Fixed ValidService5 example in test files to properly demonstrate valid service usage
  - Updated test snapshots to reflect the corrected behavior

## 0.31.1

### Patch Changes

- [#317](https://github.com/Effect-TS/language-service/pull/317) [`a5810a7`](https://github.com/Effect-TS/language-service/commit/a5810a7c8835978aaf122fd3d75100032cb0e740) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Avoid adding comment for layers with no deps requires no provides

- [#314](https://github.com/Effect-TS/language-service/pull/314) [`2aaa6e1`](https://github.com/Effect-TS/language-service/commit/2aaa6e1fef0ab943a9952303ecc7158e1deba795) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Update development workflow documentation in CLAUDE.md and fix pr-ai script command

## 0.31.0

### Minor Changes

- [#312](https://github.com/Effect-TS/language-service/pull/312) [`5d4f5c6`](https://github.com/Effect-TS/language-service/commit/5d4f5c66b820ede8d836f99c7d6617aa5f70347d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add missingEffectServiceDependency diagnostic

  This diagnostic warns when an `Effect.Service` declaration has missing service dependencies. It checks if all services used within the service's effect are properly declared in the dependencies array.

  Example:

  ```ts
  // This will show a warning because SampleService1 is used but not declared in dependencies
  export class InvalidService extends Effect.Service<InvalidService>()(
    "InvalidService",
    {
      effect: Effect.gen(function* () {
        const sampleService1 = yield* SampleService1;
        return {
          constant: Effect.succeed(sampleService1.value),
        };
      }),
      // Missing: dependencies: [SampleService1.Default]
    }
  ) {}
  ```

## 0.30.0

### Minor Changes

- [#311](https://github.com/Effect-TS/language-service/pull/311) [`f2dc3c4`](https://github.com/Effect-TS/language-service/commit/f2dc3c4f6c46f11f11c778bfb200989f286501cc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `unsupportedServiceAccessors` diagnostic that warns when using `Effect.Service` with `accessors: true` but methods have generics or multiple signatures

- [#309](https://github.com/Effect-TS/language-service/pull/309) [`949d5eb`](https://github.com/Effect-TS/language-service/commit/949d5eb409ffa79d73cbe77d13274549137708c2) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `classSelfMismatch` diagnostic rule

  This new diagnostic rule checks that the Self type parameter in Effect.Service, Context.Tag, and Schema classes matches the actual class name.

  Example:

  ```typescript
  // ❌ Error: Self type parameter should be 'MyService'
  class MyService extends Effect.Service<WrongName>()("MyService", {
    succeed: { value: 1 },
  }) {}

  // ✅ Correct
  class MyService extends Effect.Service<MyService>()("MyService", {
    succeed: { value: 1 },
  }) {}
  ```

  The diagnostic includes a quick fix to automatically correct the mismatch.

## 0.29.0

### Minor Changes

- [#306](https://github.com/Effect-TS/language-service/pull/306) [`7f3facc`](https://github.com/Effect-TS/language-service/commit/7f3faccce5eea2381398a2a0671bf4f057a4281a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Extract TypeScript utilities into a dedicated TypeScriptUtils module

  This refactoring improves code organization by consolidating TypeScript-related utilities into a separate `TypeScriptUtils` module. The changes include:

  - Created new `src/core/TypeScriptUtils.ts` module containing all TypeScript utility functions
  - Removed the old `src/core/AST.ts` file which contained scattered utilities
  - Updated all imports across the codebase to use the new module structure
  - Improved type safety and consistency in TypeScript API interactions
  - Enhanced modularity by using the Nano dependency injection pattern

  This change maintains backward compatibility while providing better separation of concerns and easier maintenance of TypeScript-related functionality.

- [#308](https://github.com/Effect-TS/language-service/pull/308) [`e649978`](https://github.com/Effect-TS/language-service/commit/e649978541cb44a238261a8cda0699227cca760a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add codegen functionality including:
  - New completion provider for Effect codegens via comments
  - New diagnostic for outdated Effect codegen with quickfixes
  - Improved tag class accessors refactor with better formatting
  - Enhanced TypeScript utilities and type parsing capabilities

## 0.28.3

### Patch Changes

- [#303](https://github.com/Effect-TS/language-service/pull/303) [`e603a89`](https://github.com/Effect-TS/language-service/commit/e603a8967770d74e63000ea2214edc006a5d4991) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor AutoImport provider and add sortText support

- [#304](https://github.com/Effect-TS/language-service/pull/304) [`5885afe`](https://github.com/Effect-TS/language-service/commit/5885afe0da37b3ffc80602c2f5fa5cbedd7e3fb2) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add middleware for auto-import quickfixes

  - Extracted auto-import logic into a reusable `AutoImport` core module
  - Refactored existing middleware auto-import completion to use the new shared `AutoImport` provider
  - This enables consistent auto-import behavior across both completions and quickfixes

- [#301](https://github.com/Effect-TS/language-service/pull/301) [`d6b36f8`](https://github.com/Effect-TS/language-service/commit/d6b36f82f43cc98de733210148da9973d199c34b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Update message for multiple Effect.provide diagnostic

## 0.28.2

### Patch Changes

- [#299](https://github.com/Effect-TS/language-service/pull/299) [`03e69b5`](https://github.com/Effect-TS/language-service/commit/03e69b53b870c6c3e51e609fdc433586a39a0121) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Warn about subsequent Effect.provide

## 0.28.1

### Patch Changes

- [#297](https://github.com/Effect-TS/language-service/pull/297) [`df95896`](https://github.com/Effect-TS/language-service/commit/df95896c566d9c93aa4b39230964dd12839fbbf5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - add Implement Service accessors refactor

## 0.28.0

### Minor Changes

- [#291](https://github.com/Effect-TS/language-service/pull/291) [`ec52012`](https://github.com/Effect-TS/language-service/commit/ec5201258f13a88fa7aa72d77acf2aac2dba803b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor auto-imports to support multiple entrypoints

### Patch Changes

- [#289](https://github.com/Effect-TS/language-service/pull/289) [`0f98a54`](https://github.com/Effect-TS/language-service/commit/0f98a5401addd64ab25881108d0fa3f5e6c497ec) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Ensure that diagnostics are collected before codefixes

## 0.27.2

### Patch Changes

- [#287](https://github.com/Effect-TS/language-service/pull/287) [`aae4cab`](https://github.com/Effect-TS/language-service/commit/aae4cab2511f0fb2c19e74a54658370a5ee4516a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Move codefixes registration hack into init phase

## 0.27.1

### Patch Changes

- [#284](https://github.com/Effect-TS/language-service/pull/284) [`0d9842b`](https://github.com/Effect-TS/language-service/commit/0d9842b384d854b3be292eda8166b463360fd3c5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix make schema opaque for non-object and non-union schemas

- [#282](https://github.com/Effect-TS/language-service/pull/282) [`3a3bedf`](https://github.com/Effect-TS/language-service/commit/3a3bedfda91c97845225a1513e641a051a872dda) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Skip entirely execution of disabled rules

- [#285](https://github.com/Effect-TS/language-service/pull/285) [`c4ac535`](https://github.com/Effect-TS/language-service/commit/c4ac5357bc5573baffdc652f3524140eb5a3a888) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add autocompletion for Schema.brand

## 0.27.0

### Minor Changes

- [#280](https://github.com/Effect-TS/language-service/pull/280) [`fe779e2`](https://github.com/Effect-TS/language-service/commit/fe779e28f635cede8a1814cfaed8679e6a4e94f3) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add strict boolean expressions rule

## 0.26.0

### Minor Changes

- [#278](https://github.com/Effect-TS/language-service/pull/278) [`b7f5580`](https://github.com/Effect-TS/language-service/commit/b7f55804a9e220fd7d972a8255369a0b7cb1ce6b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add warning for unnecessary pipe chains

- [#276](https://github.com/Effect-TS/language-service/pull/276) [`133c88e`](https://github.com/Effect-TS/language-service/commit/133c88e8da86f1ffea25ccddaab1c910b34c7d7a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor to toggle pipe style

## 0.25.1

### Patch Changes

- [#274](https://github.com/Effect-TS/language-service/pull/274) [`82b79e6`](https://github.com/Effect-TS/language-service/commit/82b79e6f5620a417ae48210c116fc2466c80b6b7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow scope to be a leaking service

## 0.25.0

### Minor Changes

- [#271](https://github.com/Effect-TS/language-service/pull/271) [`010498c`](https://github.com/Effect-TS/language-service/commit/010498c60c6c0970e1f40c0fc4e23e7cc9ce4d78) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Warn on usage of try/catch inside `Effect.gen`

- [#266](https://github.com/Effect-TS/language-service/pull/266) [`e416045`](https://github.com/Effect-TS/language-service/commit/e416045cc240a1fcdc899c5674f8d1f74cb1c398) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Rule that warns about effect's inside the void channel

### Patch Changes

- [#270](https://github.com/Effect-TS/language-service/pull/270) [`441123e`](https://github.com/Effect-TS/language-service/commit/441123eaadb724f98b06de3c22a05360dd221898) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add completions suggestions for DurationInput values

## 0.24.2

### Patch Changes

- [#264](https://github.com/Effect-TS/language-service/pull/264) [`280a16e`](https://github.com/Effect-TS/language-service/commit/280a16e6448779eb3969248b54de8d4b242fc511) Thanks [@johtso](https://github.com/johtso)! - Fix typo

## 0.24.1

### Patch Changes

- [#262](https://github.com/Effect-TS/language-service/pull/262) [`401701f`](https://github.com/Effect-TS/language-service/commit/401701f56f0fe59708d1238c2c193dcadb124ecb) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Use pako for mermaid url generation

## 0.24.0

### Minor Changes

- [#259](https://github.com/Effect-TS/language-service/pull/259) [`77b25ae`](https://github.com/Effect-TS/language-service/commit/77b25ae48c8edaac45acae1e0a7e5f1550ba4c1c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add rule that reports Layer with scope

### Patch Changes

- [#257](https://github.com/Effect-TS/language-service/pull/257) [`d875f85`](https://github.com/Effect-TS/language-service/commit/d875f85fa6d7616f80804cfeea4fc75da7b261df) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add quickfixes to missingEffectError to implement catchAll or catchTags based on the missing errors context

## 0.23.5

### Patch Changes

- [#254](https://github.com/Effect-TS/language-service/pull/254) [`3f9c0c0`](https://github.com/Effect-TS/language-service/commit/3f9c0c05be4a3c8b2cfbcdb8dc8dca8ec1d73364) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix codefix importFromBarrel when alias involved

## 0.23.4

### Patch Changes

- [#251](https://github.com/Effect-TS/language-service/pull/251) [`19dcecf`](https://github.com/Effect-TS/language-service/commit/19dcecf88d6256f71a4a9b7b0984a4ae69ca872e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow wildcard \* at end of ImportPackages settings to match all packages starting with a prefix

## 0.23.3

### Patch Changes

- [#247](https://github.com/Effect-TS/language-service/pull/247) [`b7abbdf`](https://github.com/Effect-TS/language-service/commit/b7abbdf32da0b1e1c2aa5dfd9c81bc8da15670fa) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add exclusion rules for barrel style so pipe will be imported from "effect" instead of "effect/Function"

## 0.23.2

### Patch Changes

- [#245](https://github.com/Effect-TS/language-service/pull/245) [`dca2e6f`](https://github.com/Effect-TS/language-service/commit/dca2e6f0617e4de917f052301ce466e56c209f71) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow throw as way to break gen control flow

## 0.23.1

### Patch Changes

- [#242](https://github.com/Effect-TS/language-service/pull/242) [`df1e16b`](https://github.com/Effect-TS/language-service/commit/df1e16b6dd59e611b6cbaeda00d9b468c0be4b46) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix barrelImportPackages duplicate imports

## 0.23.0

### Minor Changes

- [#239](https://github.com/Effect-TS/language-service/pull/239) [`712a52f`](https://github.com/Effect-TS/language-service/commit/712a52f0fbd11b03197727e2d17672d569988c44) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for barrel imports suggestions

## 0.22.3

### Patch Changes

- [#237](https://github.com/Effect-TS/language-service/pull/237) [`40f2c7c`](https://github.com/Effect-TS/language-service/commit/40f2c7ceb68ccd261a55aa8d3b49e8770562b061) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Delay completions computations to completionEntryDetails where possible

## 0.22.2

### Patch Changes

- [#235](https://github.com/Effect-TS/language-service/pull/235) [`0888757`](https://github.com/Effect-TS/language-service/commit/0888757b1d5e3c68548d0dfd590e18f374ab86af) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add auto-completion for effect directives

## 0.22.1

### Patch Changes

- [#234](https://github.com/Effect-TS/language-service/pull/234) [`6183db0`](https://github.com/Effect-TS/language-service/commit/6183db079cb56eb299bb762ed162fc1bc761e24d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Micro perf opt

- [#232](https://github.com/Effect-TS/language-service/pull/232) [`fc603bd`](https://github.com/Effect-TS/language-service/commit/fc603bd5e5d26d893e6fdf7ad396f36392bb0484) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Perf: skip checking missing services/context for the same type

## 0.22.0

### Minor Changes

- [#231](https://github.com/Effect-TS/language-service/pull/231) [`c31ab93`](https://github.com/Effect-TS/language-service/commit/c31ab932bdc3c9d4d580fb674e350acfdc385ba0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add ability to prefer namespace imports for a package

### Patch Changes

- [#229](https://github.com/Effect-TS/language-service/pull/229) [`d2b6b31`](https://github.com/Effect-TS/language-service/commit/d2b6b3158085ff2a8f55631b30e0625f4f74865c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Move default diagnostic severity to rule definition

## 0.21.8

### Patch Changes

- [#227](https://github.com/Effect-TS/language-service/pull/227) [`0f2a403`](https://github.com/Effect-TS/language-service/commit/0f2a403d9f9e4c8df92ab4717d5d808ea989a580) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Enable Effect Type Parameters also for returned effects with truncated signatures

## 0.21.7

### Patch Changes

- [#225](https://github.com/Effect-TS/language-service/pull/225) [`b22cc2c`](https://github.com/Effect-TS/language-service/commit/b22cc2c6b200592830aef5b508c0dde016b306ab) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve diagnostics phrasing and link to docs

## 0.21.6

### Patch Changes

- [#222](https://github.com/Effect-TS/language-service/pull/222) [`f7e9f2c`](https://github.com/Effect-TS/language-service/commit/f7e9f2cacbda4239482aaa0d94ab53f15373641b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix symbol access on some nodes

## 0.21.5

### Patch Changes

- [#219](https://github.com/Effect-TS/language-service/pull/219) [`346a556`](https://github.com/Effect-TS/language-service/commit/346a556fdcda43b58e9bae8206dbf2e16691ff66) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Switch to emit style for internal diagnostics

- [#221](https://github.com/Effect-TS/language-service/pull/221) [`85def8b`](https://github.com/Effect-TS/language-service/commit/85def8b2b9c091bd22c57bc4da7cd485557b8f88) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Trigger returnEffectInGen only for strict effect type

## 0.21.4

### Patch Changes

- [#218](https://github.com/Effect-TS/language-service/pull/218) [`5243677`](https://github.com/Effect-TS/language-service/commit/52436772a75f2758650239a71ca42dc0d68b354d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add diagnostic when missing yield\* in return Effect

- [#215](https://github.com/Effect-TS/language-service/pull/215) [`207d06b`](https://github.com/Effect-TS/language-service/commit/207d06b043870d33751f4d06e8a0f1589c6b8024) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Warn about definitions of generic services

## 0.21.3

### Patch Changes

- [#213](https://github.com/Effect-TS/language-service/pull/213) [`3487467`](https://github.com/Effect-TS/language-service/commit/34874674d4a1f9a4aeeb769200335c74a7151d76) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve message for return yield\* diagnostic

- [#211](https://github.com/Effect-TS/language-service/pull/211) [`c52cd0e`](https://github.com/Effect-TS/language-service/commit/c52cd0e8dffd7e7f226912b029108d9f49831b2b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add documentation for usage with SvelteKit LSP

- [#214](https://github.com/Effect-TS/language-service/pull/214) [`27a0d41`](https://github.com/Effect-TS/language-service/commit/27a0d414287445e9d2cd7105714af98d3df37bc6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add found at path in duplicate check

## 0.21.2

### Patch Changes

- [#209](https://github.com/Effect-TS/language-service/pull/209) [`eea3e8f`](https://github.com/Effect-TS/language-service/commit/eea3e8f011426e8c88c5d156721933ac5f7e4c74) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add starting log

## 0.21.1

### Patch Changes

- [#207](https://github.com/Effect-TS/language-service/pull/207) [`7b7906a`](https://github.com/Effect-TS/language-service/commit/7b7906a92e2823cee5ba707c565b351218820a2a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Diagnostic to report unnecessary pipe calls

- [#205](https://github.com/Effect-TS/language-service/pull/205) [`4e921b5`](https://github.com/Effect-TS/language-service/commit/4e921b59e1a10c82913bcd40b5d177f15d2ba71e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow to change diagnostic severity inside the LSP options

## 0.21.0

### Minor Changes

- [#199](https://github.com/Effect-TS/language-service/pull/199) [`5e037ec`](https://github.com/Effect-TS/language-service/commit/5e037ecfa37af20c96324b9d9d518a4631bf48be) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add leaking requirements diagnostic

### Patch Changes

- [#200](https://github.com/Effect-TS/language-service/pull/200) [`045c70d`](https://github.com/Effect-TS/language-service/commit/045c70d72d3f7684381650ae26710b84b2ff6180) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Make TypeParser a first class service

- [#196](https://github.com/Effect-TS/language-service/pull/196) [`ea894af`](https://github.com/Effect-TS/language-service/commit/ea894af9ea410de88cb1cc759d0953aca99a05ff) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add option to disable goto functionalities

- [#194](https://github.com/Effect-TS/language-service/pull/194) [`5e58b25`](https://github.com/Effect-TS/language-service/commit/5e58b25797b2c6afa162dd3a84978993e7474c1c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add aggressive caching on type parsers

## 0.20.1

### Patch Changes

- [#191](https://github.com/Effect-TS/language-service/pull/191) [`3cf789b`](https://github.com/Effect-TS/language-service/commit/3cf789b8b546f7eaeb82913e328f9da6b62c07b0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix parenthesized type handling

- [#193](https://github.com/Effect-TS/language-service/pull/193) [`09b19f9`](https://github.com/Effect-TS/language-service/commit/09b19f9242153901aa24ddeb448315b9a2b47672) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Handle special pattern of (typeof A)[keyof typeof A]

## 0.20.0

### Minor Changes

- [#188](https://github.com/Effect-TS/language-service/pull/188) [`e04578e`](https://github.com/Effect-TS/language-service/commit/e04578ecb7ef13519ba4e877e3b1fa4c1df55634) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add error when yield\* with never-completing effect is not returned

- [#190](https://github.com/Effect-TS/language-service/pull/190) [`f3a1e25`](https://github.com/Effect-TS/language-service/commit/f3a1e25450289f22b8a1b8710481ff9c46c0183c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add completions for Rpc.make while declaring classes

- [#189](https://github.com/Effect-TS/language-service/pull/189) [`9c1b0d2`](https://github.com/Effect-TS/language-service/commit/9c1b0d25853a9d225af412da30ddfff49a0aacf1) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow goto definition to Jump to Rpc definition object

### Patch Changes

- [#186](https://github.com/Effect-TS/language-service/pull/186) [`cdfff27`](https://github.com/Effect-TS/language-service/commit/cdfff27675e86df19f7f0398e82aca1ae3797a7f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Unify pipe parsing

## 0.19.0

### Minor Changes

- [#182](https://github.com/Effect-TS/language-service/pull/182) [`e3f52a6`](https://github.com/Effect-TS/language-service/commit/e3f52a685be7f55d143011967890001aad9dc70d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add quickinfo for Layers

## 0.18.1

### Patch Changes

- [#179](https://github.com/Effect-TS/language-service/pull/179) [`a170bfc`](https://github.com/Effect-TS/language-service/commit/a170bfc097b2d1e97b3db0f5b9d19093b24117ac) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Handle unnecessary Effect.gen even when yielded expression is not returned

  ```ts
  export const shouldRaiseForSingle = Effect.gen(function* () {
    yield* Effect.succeed(42);
  });
  // ^- this will become Effect.asVoid(Effect.succeed(42))

  export const shouldRaiseForSingleReturnVoid = Effect.gen(function* () {
    yield* Effect.void;
  });
  // ^- this will become Effect.void
  ```

## 0.18.0

### Minor Changes

- [#177](https://github.com/Effect-TS/language-service/pull/177) [`9d2ee02`](https://github.com/Effect-TS/language-service/commit/9d2ee027df08e6fdd24bb7311dda76da44ac9bdc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Check duplicated package for any that has peer dependency on Effect

### Patch Changes

- [#178](https://github.com/Effect-TS/language-service/pull/178) [`9baf025`](https://github.com/Effect-TS/language-service/commit/9baf025dd0a3ca423d1399fd776a294666bc27b8) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Avoid multiple LSP patching

- [#176](https://github.com/Effect-TS/language-service/pull/176) [`f9fca38`](https://github.com/Effect-TS/language-service/commit/f9fca386ed59947b45020026a3692a3cd652db4f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix false positive of logical assignments closes #166

- [#168](https://github.com/Effect-TS/language-service/pull/168) [`5e9e7c9`](https://github.com/Effect-TS/language-service/commit/5e9e7c9008c69e50b2c0ed3c10e1c4d979a4d0dc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Remove fixed effect/ from all rules and refactors, improve testing setup

- [#170](https://github.com/Effect-TS/language-service/pull/170) [`a492078`](https://github.com/Effect-TS/language-service/commit/a492078398696ee824b7679bc11469ec3eddfe3f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add disable next line feature

- [#171](https://github.com/Effect-TS/language-service/pull/171) [`93db3db`](https://github.com/Effect-TS/language-service/commit/93db3db7261fb9fb3b776dcea128833858f4d477) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Update setup to auto-format example files

- [#174](https://github.com/Effect-TS/language-service/pull/174) [`824b249`](https://github.com/Effect-TS/language-service/commit/824b249ba5ba8d34db39da776d748337c1819270) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add Pool as effect subtype allowed to be floating

- [#173](https://github.com/Effect-TS/language-service/pull/173) [`74e6fcd`](https://github.com/Effect-TS/language-service/commit/74e6fcd0d2868d94031bb0cf31d40988f477057a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix false positive with yield\* and function declaration

- [#175](https://github.com/Effect-TS/language-service/pull/175) [`4bb23a0`](https://github.com/Effect-TS/language-service/commit/4bb23a05a371672468882fa54583179d29995090) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Better whitespace handling while inserting disable next line comments

## 0.17.1

### Patch Changes

- [#163](https://github.com/Effect-TS/language-service/pull/163) [`5f0ac85`](https://github.com/Effect-TS/language-service/commit/5f0ac855979e1415cc9cfbe8c1540a38bb9605e9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for Effect.fn completions

## 0.17.0

### Minor Changes

- [#160](https://github.com/Effect-TS/language-service/pull/160) [`a1114b4`](https://github.com/Effect-TS/language-service/commit/a1114b47aa9a04ac203a2c5623a5fd6444e1a312) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add .gen(function\*(){}) autocompletion

## 0.16.7

### Patch Changes

- [#158](https://github.com/Effect-TS/language-service/pull/158) [`2a46a72`](https://github.com/Effect-TS/language-service/commit/2a46a728d2579b30f8b0f5e069a7e7f1dc0e59e4) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - In type to effect schema, follow top level typeof nodes

## 0.16.6

### Patch Changes

- [#155](https://github.com/Effect-TS/language-service/pull/155) [`94eb402`](https://github.com/Effect-TS/language-service/commit/94eb4027e687eb43b22c56161bd9909ab43780c9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix handling of nested pipes in effectGenToFn refactor

## 0.16.5

### Patch Changes

- [#153](https://github.com/Effect-TS/language-service/pull/153) [`20eaf91`](https://github.com/Effect-TS/language-service/commit/20eaf91ecd729742650b205c1b51a114a06f161f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Skip checking effects in type parameters initializers

## 0.16.4

### Patch Changes

- [#151](https://github.com/Effect-TS/language-service/pull/151) [`242e37b`](https://github.com/Effect-TS/language-service/commit/242e37b471ba377c3e3162d74c3256728a641864) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve arrow function handling for type inference

## 0.16.3

### Patch Changes

- [#148](https://github.com/Effect-TS/language-service/pull/148) [`af83cbb`](https://github.com/Effect-TS/language-service/commit/af83cbb50d6a756f3594771d2b6b7d417eedf18c) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix ts-patch transform error while emitting info diagnostics

## 0.16.2

### Patch Changes

- [#146](https://github.com/Effect-TS/language-service/pull/146) [`29559b7`](https://github.com/Effect-TS/language-service/commit/29559b7e01c824c5003224492d92c2a3e82ba4ca) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Handle generation of keyof for type to schema refactor

## 0.16.1

### Patch Changes

- [#142](https://github.com/Effect-TS/language-service/pull/142) [`4922981`](https://github.com/Effect-TS/language-service/commit/4922981d0a4888ced044e89a1a77f2d1c55ed510) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Inline internal Nano ctx to improve perf

## 0.16.0

### Minor Changes

- [#139](https://github.com/Effect-TS/language-service/pull/139) [`5631a87`](https://github.com/Effect-TS/language-service/commit/5631a871c81e859a418a06a2c3d26a89a9026931) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add quickinfo hover for yield\* statements

## 0.15.1

### Patch Changes

- [#135](https://github.com/Effect-TS/language-service/pull/135) [`cb14330`](https://github.com/Effect-TS/language-service/commit/cb143307ef00da7ccdcc75487e157dccd3625fb7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add missing record and intersection into type to schema refactor

- [#137](https://github.com/Effect-TS/language-service/pull/137) [`3a29ddb`](https://github.com/Effect-TS/language-service/commit/3a29ddbe5fded7e085e4e17caf296b263a2603bc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Use a single Schema.Literal call in unions of literals

## 0.15.0

### Minor Changes

- [#133](https://github.com/Effect-TS/language-service/pull/133) [`5990d51`](https://github.com/Effect-TS/language-service/commit/5990d51c3c141947f9ef6c5c6f6865ffa5847408) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add type to schema refactor

## 0.14.0

### Minor Changes

- [#128](https://github.com/Effect-TS/language-service/pull/128) [`73307e0`](https://github.com/Effect-TS/language-service/commit/73307e0e4e2525a02ec8b5a28b185642fd098cab) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Support ts-patch transformer to emit diagnostics at compile time

## 0.13.0

### Minor Changes

- [#125](https://github.com/Effect-TS/language-service/pull/125) [`8fdf421`](https://github.com/Effect-TS/language-service/commit/8fdf421d74a6fd1571b3949e88bee0ccf7a5d932) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add a check for multiple effect versions in the same project

### Patch Changes

- [#127](https://github.com/Effect-TS/language-service/pull/127) [`731e72a`](https://github.com/Effect-TS/language-service/commit/731e72a3526fe3efed31de3a34cf7a56155a50d0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Skip some nodes while evaluating expected types

## 0.12.2

### Patch Changes

- [#122](https://github.com/Effect-TS/language-service/pull/122) [`b261a4b`](https://github.com/Effect-TS/language-service/commit/b261a4bbb54b375c7a648249831798622547947e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix single line if blocks mismatched as unnecessary gen

## 0.12.1

### Patch Changes

- [#120](https://github.com/Effect-TS/language-service/pull/120) [`bbade6b`](https://github.com/Effect-TS/language-service/commit/bbade6b9f803c26c3be851e1c793b1b85fdec6f8) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor to make schema opaque using namespaces

## 0.12.0

### Minor Changes

- [#118](https://github.com/Effect-TS/language-service/pull/118) [`8d2cb57`](https://github.com/Effect-TS/language-service/commit/8d2cb57d948f8671dd6beec567e20c88c1c60721) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refator to make a schema opaque

## 0.11.0

### Minor Changes

- [#116](https://github.com/Effect-TS/language-service/pull/116) [`397b4b9`](https://github.com/Effect-TS/language-service/commit/397b4b9a87784576e12add739f77bc5783c4dcc3) Thanks [@wmaurer](https://github.com/wmaurer)! - Add refactor to wrap an `Effect` expression with `Effect.gen`.

## 0.10.2

### Patch Changes

- [#114](https://github.com/Effect-TS/language-service/pull/114) [`4e5f345`](https://github.com/Effect-TS/language-service/commit/4e5f34538affbcadf3bb7b583b2286bd62563a53) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Perf improvements and shrinked build

## 0.10.1

### Patch Changes

- [#112](https://github.com/Effect-TS/language-service/pull/112) [`1c16ecc`](https://github.com/Effect-TS/language-service/commit/1c16ecc3988ec3a37d8a56b1e6c926b267516c9a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Perf: solve codefixes and diagnostics in a single pass and cache between them

## 0.10.0

### Minor Changes

- [#110](https://github.com/Effect-TS/language-service/pull/110) [`71f84ed`](https://github.com/Effect-TS/language-service/commit/71f84eda227b9af04e287f3e2a5457cc956e441d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow to customize diagnostic severity by using a comment line

## 0.9.2

### Patch Changes

- [#109](https://github.com/Effect-TS/language-service/pull/109) [`c325568`](https://github.com/Effect-TS/language-service/commit/c325568fb6a0e6faf8524759ffe3f7ff4f21dee7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for completions for Data.TaggedClass and Data.TaggedError

- [#106](https://github.com/Effect-TS/language-service/pull/106) [`63cc227`](https://github.com/Effect-TS/language-service/commit/63cc2279cf0d822d2242566c7276f60d4d5bb18b) Thanks [@wmaurer](https://github.com/wmaurer)! - Fixed a bug where certain refactors were not available when the cursor was position at the start of a node

## 0.9.1

### Patch Changes

- [#103](https://github.com/Effect-TS/language-service/pull/103) [`3810a5a`](https://github.com/Effect-TS/language-service/commit/3810a5ad1e9494c87824b06da4f378e68c6f9ec0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add README to shipped dist

## 0.9.0

### Minor Changes

- [#100](https://github.com/Effect-TS/language-service/pull/100) [`4ca4fa2`](https://github.com/Effect-TS/language-service/commit/4ca4fa2fbd4bcf7bffdc671972f18e3377e8f8e2) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Optimize hot paths and introduce internal caching for expensive APIs

- [#102](https://github.com/Effect-TS/language-service/pull/102) [`31f72ea`](https://github.com/Effect-TS/language-service/commit/31f72ea6cd5885adcc6e94a813d910c7b9c1013e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for smart completions for effect classes with "Self"

## 0.8.1

### Patch Changes

- [#97](https://github.com/Effect-TS/language-service/pull/97) [`bbdf5e0`](https://github.com/Effect-TS/language-service/commit/bbdf5e02f11032ac4c41680064c0c903f1c5f271) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for codefixes in custom diagnostics

## 0.8.0

### Minor Changes

- [#93](https://github.com/Effect-TS/language-service/pull/93) [`92bbee1`](https://github.com/Effect-TS/language-service/commit/92bbee18204dc84f730af7eb7f27f5828fed1f77) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Reorganize internals, tests and add failure-recovery paths

### Patch Changes

- [#96](https://github.com/Effect-TS/language-service/pull/96) [`dba85b6`](https://github.com/Effect-TS/language-service/commit/dba85b60d070ec64c90282bb0b28fb3cda41be23) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor to remove unnecessary Effect.gen definitions

## 0.7.1

### Patch Changes

- [#90](https://github.com/Effect-TS/language-service/pull/90) [`63dd3e0`](https://github.com/Effect-TS/language-service/commit/63dd3e07d10bc47f8ff4d4fdc4839147da1f2a5f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix accidental bundle of ts in lsp

## 0.7.0

### Minor Changes

- [#88](https://github.com/Effect-TS/language-service/pull/88) [`c3944ce`](https://github.com/Effect-TS/language-service/commit/c3944cedd2a236284de5aafa62b5e08f5498f6bf) Thanks [@wmaurer](https://github.com/wmaurer)! - Add refactor remove-unnecessary-effect-gen. This removes unnecessary `Effect.gen` calls by simplifying generator functions that only wrap a single `yield*` statement returning an `Effect`. This refactor replaces the `Effect.gen` wrapper with the inner `Effect` directly, making the code more concise and readable.

## 0.6.2

### Patch Changes

- [#84](https://github.com/Effect-TS/language-service/pull/84) [`a6d163d`](https://github.com/Effect-TS/language-service/commit/a6d163de182fa79551a61c9bca88a03f3cdb31be) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix useless gen severity

## 0.6.1

### Patch Changes

- [#83](https://github.com/Effect-TS/language-service/pull/83) [`6708b71`](https://github.com/Effect-TS/language-service/commit/6708b717e7f2f44fb8094eb98d885bf79111dbea) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix return type infer inside function overloads

- [#79](https://github.com/Effect-TS/language-service/pull/79) [`106e498`](https://github.com/Effect-TS/language-service/commit/106e498a2d6441d0e671604a065ef2578a7f7cd6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Handle refactor gen to fn in class methods

- [#81](https://github.com/Effect-TS/language-service/pull/81) [`65dc94b`](https://github.com/Effect-TS/language-service/commit/65dc94b2f08c7f0449cbd75c4a1ad8bdf84835e2) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Always use type information to resolve Effect module name

## 0.6.0

### Minor Changes

- [#76](https://github.com/Effect-TS/language-service/pull/76) [`486b171`](https://github.com/Effect-TS/language-service/commit/486b1718edd43fec6dc2718c07f3aadef4bec87d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor to rewrite Effect.gen to Effect.fn

### Patch Changes

- [#78](https://github.com/Effect-TS/language-service/pull/78) [`2c7d56b`](https://github.com/Effect-TS/language-service/commit/2c7d56bb9ba85c0302e07b195ca52bba9a815a67) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix async await to effect gen with anonymous functions

## 0.5.1

### Patch Changes

- [#73](https://github.com/Effect-TS/language-service/pull/73) [`3c9c1ba`](https://github.com/Effect-TS/language-service/commit/3c9c1ba9a7d5ae6eadc4d4c3e9d0737fd0c8f21f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Avoid to bail-out type generation when imports are missing, show instead partial signature

## 0.5.0

### Minor Changes

- [#71](https://github.com/Effect-TS/language-service/pull/71) [`8d309ab`](https://github.com/Effect-TS/language-service/commit/8d309ab2d7ab73bae97cb4cac4c54c3f8ab88d42) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Detect unnecessary usages of Effect.gen

- [#68](https://github.com/Effect-TS/language-service/pull/68) [`79ce0b1`](https://github.com/Effect-TS/language-service/commit/79ce0b1c7c3cd04db53668d76710bc50284ebae9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Adds support for quickinfo for effect

  They can be disabled by the LSP option "quickinfo": false.

  Once you hover a truncated type, you'll see additional information about the Effect type arguments like Success, Failure and Requirements.

### Patch Changes

- [#72](https://github.com/Effect-TS/language-service/pull/72) [`3a99040`](https://github.com/Effect-TS/language-service/commit/3a99040fe86fe11855a2d0e4288197f2c4af11a1) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for toggle type annotation in class property members

## 0.4.0

### Minor Changes

- [#66](https://github.com/Effect-TS/language-service/pull/66) [`89d6fa9`](https://github.com/Effect-TS/language-service/commit/89d6fa9647717b856113cbd13c41811c033baf4f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Remove old transformer

- [#67](https://github.com/Effect-TS/language-service/pull/67) [`5111a65`](https://github.com/Effect-TS/language-service/commit/5111a65046a01d82583b34ba8f2d1a2d4945e5a5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Handle Effect.fn and Effect.fnUntraced in missing yield star diagnostic

### Patch Changes

- [#64](https://github.com/Effect-TS/language-service/pull/64) [`f8d5018`](https://github.com/Effect-TS/language-service/commit/f8d501886585d58cc391af119463223817ccb93b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Upgrade used TS version

## 0.3.2

### Patch Changes

- [#61](https://github.com/Effect-TS/language-service/pull/61) [`796db99`](https://github.com/Effect-TS/language-service/commit/796db99401f501ddf45f934192d1f07068839ea9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix binary assignment reported as floating effect

- [#63](https://github.com/Effect-TS/language-service/pull/63) [`ae973cb`](https://github.com/Effect-TS/language-service/commit/ae973cbb0dc7d068400c515e8629f8e20bbf1f36) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow Exit subtype to be a floating Effect

## 0.3.1

### Patch Changes

- [#58](https://github.com/Effect-TS/language-service/pull/58) [`d5fcb9e`](https://github.com/Effect-TS/language-service/commit/d5fcb9efc27649ab8f82e21d878071dc12be0d50) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow Fiber and FiberRuntime to be floating

- [#60](https://github.com/Effect-TS/language-service/pull/60) [`bf12970`](https://github.com/Effect-TS/language-service/commit/bf129706a7f070be171ba22172f33253333b1d03) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Additional notice for misused yield instead of yield\* in generators

## 0.3.0

### Minor Changes

- [#54](https://github.com/Effect-TS/language-service/pull/54) [`19e5a77`](https://github.com/Effect-TS/language-service/commit/19e5a7744c443ca10ab5cea1bcd70f636c3142d7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - - Update internal version of effect from 2.x beta to 3.12.5

  - Remove adapter from gen refactors

- [#56](https://github.com/Effect-TS/language-service/pull/56) [`5b2b27c`](https://github.com/Effect-TS/language-service/commit/5b2b27c835752650e870534890112d20f36cb530) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for Effect diagnostics

  With this release of the language service plugin, we aim to improve the overall Effect experience by providing additional diagnostics that tries to fix misleading or hard to read TypeScript errors.

  All of the diagnostics provided by the language service are available only in editor-mode, that means that they won't show up when using tsc.

  Diagnostics are enabled by default, but you can opt-out of them by changing the language service configuration and provide diagnostics: false.

  ```json
  {
    "plugins": [
      {
        "name": "@effect/language-service",
        "diagnostics": false
      }
    ]
  }
  ```

  Please report any false positive or missing diagnostic you encounter over the Github repository.

  ## Missing Errors and Services in Effects

  Additionally to the standard TypeScript error that may be cryptic at first:

  ```
  Argument of type 'Effect<number, never, ServiceB | ServiceA | ServiceC>' is not assignable to parameter of type 'Effect<number, never, ServiceB | ServiceA>' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
    Type 'ServiceB | ServiceA | ServiceC' is not assignable to type 'ServiceB | ServiceA'.
      Type 'ServiceC' is not assignable to type 'ServiceB | ServiceA'.
        Type 'ServiceC' is not assignable to type 'ServiceA'.
          Types of property 'a' are incompatible.
            Type '3' is not assignable to type '1'.ts(2379)
  ```

  you'll now receive an additional error:

  ```
  Missing 'ServiceC' in the expected Effect context.
  ```

  ## Floating Effect

  In some situation you may not receive any compile error at all, but that's because you may have forgot to yield your effects inside gen!

  Floating Effects that are not assigned to a variable will be reported into the Effect diagnostics.

  ```ts
  Effect.runPromise(
    Effect.gen(function* () {
      Effect.sync(() => console.log("Hello!"));
      // ^- Effect must be yielded or assigned to a variable.
    })
  );
  ```

  ## Used yield instead of yield\*

  Similarly, yield instead of yield\* won't result in a type error by itself, but is not the intended usage.

  This yield will be reported in the effect diagnostics.

  ```ts
  Effect.runPromise(
    Effect.gen(function* () {
      yield Effect.sync(() => console.log("Hello!"));
      // ^- When yielding Effects inside Effect.gen, you should use yield* instead of yield.
    })
  );
  ```

## 0.2.0

### Minor Changes

- [#50](https://github.com/Effect-TS/language-service/pull/50) [`f3ff991`](https://github.com/Effect-TS/language-service/commit/f3ff991b1fede4ac0faccd7d6800ce5076d7fe7f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Dedupe identical JSDoc tags in hover quickinfo

## 0.1.0

### Minor Changes

- [#48](https://github.com/Effect-TS/language-service/pull/48) [`9bb0011`](https://github.com/Effect-TS/language-service/commit/9bb00117c1efe3aa2c7788b9c9eeed1ef001c540) Thanks [@wmaurer](https://github.com/wmaurer)! - Improve Effect imports to work with current effect npm package

- [#48](https://github.com/Effect-TS/language-service/pull/48) [`9bb0011`](https://github.com/Effect-TS/language-service/commit/9bb00117c1efe3aa2c7788b9c9eeed1ef001c540) Thanks [@wmaurer](https://github.com/wmaurer)! - Modernise build setup.
  Fix asyncWaitToGen problem for TS5.
  Refactor asyncWaitToGen to work with current Effect API.
  Add config option `preferredEffectGenAdapterName`.

## 0.0.21

### Patch Changes

- [#45](https://github.com/Effect-TS/language-service/pull/45) [`7edd368`](https://github.com/Effect-TS/language-service/commit/7edd36829c49f47fc4fe3077ad147bfb7b62111f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Remove dependencies on /data and /io

## 0.0.20

### Patch Changes

- [#43](https://github.com/Effect-TS/language-service/pull/43) [`42a032c`](https://github.com/Effect-TS/language-service/commit/42a032c2f0c12adc41fbd2d20b7556ac9a3468cb) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add toggle lazy const initializer

## 0.0.19

### Patch Changes

- [#41](https://github.com/Effect-TS/language-service/pull/41) [`282adf4`](https://github.com/Effect-TS/language-service/commit/282adf4b597ea1315c7f92367c60631514324e8d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve handling of non-datafirst in pipeable-to-datafirst rewrite

## 0.0.18

### Patch Changes

- [#39](https://github.com/Effect-TS/language-service/pull/39) [`c505074`](https://github.com/Effect-TS/language-service/commit/c505074ca6006ad136e434f90d7f750fbe8593b6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor to rewrite as datafirst

## 0.0.17

### Patch Changes

- [#37](https://github.com/Effect-TS/language-service/pull/37) [`e632c54`](https://github.com/Effect-TS/language-service/commit/e632c547371a2a1cdb53106a6383b97d1cbbd298) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix simplify behaviour with intersections of callables

## 0.0.16

### Patch Changes

- [#35](https://github.com/Effect-TS/language-service/pull/35) [`7fa9273`](https://github.com/Effect-TS/language-service/commit/7fa9273e86871fe7dd79688b85d039bd296fb074) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Make more human readable function type intersections

## 0.0.15

### Patch Changes

- [#31](https://github.com/Effect-TS/language-service/pull/31) [`ddb5b66`](https://github.com/Effect-TS/language-service/commit/ddb5b6687923e1aff04e8b57c9d984b364bb4ed7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add kind to each refactor definition

## 0.0.14

### Patch Changes

- [#29](https://github.com/Effect-TS/language-service/pull/29) [`adc3745`](https://github.com/Effect-TS/language-service/commit/adc3745e1ed4c6fad0a50ea5b42529d55cc68baa) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Remove useless pipe-related refactors (rewrite to pipe and remove pipe)

## 0.0.13

### Patch Changes

- [#27](https://github.com/Effect-TS/language-service/pull/27) [`c0636e1`](https://github.com/Effect-TS/language-service/commit/c0636e19d10a352e3905c0fd01e37af7f467b16d) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Removed diagnostics and moved them into @effect/eslint-plugin

## 0.0.12

### Patch Changes

- [#25](https://github.com/Effect-TS/language-service/pull/25) [`7495554`](https://github.com/Effect-TS/language-service/commit/74955548f6ab2c859f685c7c9d750458374612cc) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Remove @effect/io dependency

## 0.0.11

### Patch Changes

- [#23](https://github.com/Effect-TS/language-service/pull/23) [`535a2f1`](https://github.com/Effect-TS/language-service/commit/535a2f13f250077dfc28a56537a6493be90c0b9b) Thanks [@mikearnaldi](https://github.com/mikearnaldi)! - Update dependencies and improve semver ranges

## 0.0.10

### Patch Changes

- [#21](https://github.com/Effect-TS/language-service/pull/21) [`8eefaf7`](https://github.com/Effect-TS/language-service/commit/8eefaf70e5bb18c397da4313c81d4e4ecfb44b18) Thanks [@mikearnaldi](https://github.com/mikearnaldi)! - Fix transformer infinite loop

## 0.0.9

### Patch Changes

- [#19](https://github.com/Effect-TS/language-service/pull/19) [`eced128`](https://github.com/Effect-TS/language-service/commit/eced12870537e1f075cd9970b745a39f5906acf7) Thanks [@mikearnaldi](https://github.com/mikearnaldi)! - Update deps

## 0.0.8

### Patch Changes

- [#17](https://github.com/Effect-TS/language-service/pull/17) [`69a0ab1`](https://github.com/Effect-TS/language-service/commit/69a0ab17036db0dd00eb460139cb5ea97dafb9ad) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Begin eslint plugins

## 0.0.7

### Patch Changes

- [#15](https://github.com/Effect-TS/language-service/pull/15) [`4eedac0`](https://github.com/Effect-TS/language-service/commit/4eedac07d0671be1ab90d4b2cbbb31b1c650419b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Move to effect/io

## 0.0.6

### Patch Changes

- [#13](https://github.com/Effect-TS/language-service/pull/13) [`d894956`](https://github.com/Effect-TS/language-service/commit/d8949560d816f174450e8afc2b558f5ff4300ad1) Thanks [@mikearnaldi](https://github.com/mikearnaldi)! - Support functions and function expressions in debug

## 0.0.5

### Patch Changes

- [#11](https://github.com/Effect-TS/language-service/pull/11) [`f00ed7b`](https://github.com/Effect-TS/language-service/commit/f00ed7b4eb1a0b080dcbd2dfe1c293bdd29714ec) Thanks [@mikearnaldi](https://github.com/mikearnaldi)! - Add debug extension in transformer

## 0.0.4

### Patch Changes

- [#9](https://github.com/Effect-TS/language-service/pull/9) [`d11e191`](https://github.com/Effect-TS/language-service/commit/d11e191e63fdf440ce7b9b62eaffda3febeeb010) Thanks [@mikearnaldi](https://github.com/mikearnaldi)! - Update dependencies

## 0.0.3

### Patch Changes

- [#8](https://github.com/Effect-TS/language-service/pull/8) [`c68d7f6`](https://github.com/Effect-TS/language-service/commit/c68d7f67626dc78535db9ed11c59062a90354765) Thanks [@mikearnaldi](https://github.com/mikearnaldi)! - Add transformer

- [#6](https://github.com/Effect-TS/language-service/pull/6) [`0812ab0`](https://github.com/Effect-TS/language-service/commit/0812ab050caaacdb98f9d8b60a9eb9e98d410413) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor to handle no-sync-with-constants diagnostic

## 0.0.2

### Patch Changes

- [#4](https://github.com/Effect-TS/language-service/pull/4) [`a7c6718`](https://github.com/Effect-TS/language-service/commit/a7c6718f22619bc073abc805532020f6c17cad2b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor wrapWithPipe, which adds pipe() around the selected text

## 0.0.1

### Patch Changes

- [#2](https://github.com/Effect-TS/language-service/pull/2) [`8915f80`](https://github.com/Effect-TS/language-service/commit/8915f80bc927320cc636e226242899b7ef442468) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fixed type annotation removal in both toggle return type and toggle type annotation
