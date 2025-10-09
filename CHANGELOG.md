# @effect/language-service

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
