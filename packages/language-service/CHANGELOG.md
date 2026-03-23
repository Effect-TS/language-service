# @effect/language-service

## 0.82.0

### Minor Changes

- [#689](https://github.com/Effect-TS/language-service/pull/689) [`aed2074`](https://github.com/Effect-TS/language-service/commit/aed2074e250aa74a40f85219a3b9af08f61936df) Thanks [@f15u](https://github.com/f15u)! - Adds ability to reference `$schema` from local installation

- [#692](https://github.com/Effect-TS/language-service/pull/692) [`57fcf35`](https://github.com/Effect-TS/language-service/commit/57fcf35cb93c045943f8b7b5431fdce4fa0ba6e1) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add the `effectFnImplicitAny` diagnostic to mirror `noImplicitAny` for unannotated `Effect.fn` and `Effect.fnUntraced` callback parameters, and support `// @strict` in diagnostic example files so test fixtures can enable strict compiler options.

### Patch Changes

- [#687](https://github.com/Effect-TS/language-service/pull/687) [`72827c0`](https://github.com/Effect-TS/language-service/commit/72827c0dcacf0fbeb24a066e4f98c08585a39341) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Allow the leaking requirements diagnostic to suppress specific leaked services with `@effect-expect-leaking` comments on the enclosing declaration.

- [#690](https://github.com/Effect-TS/language-service/pull/690) [`77906a9`](https://github.com/Effect-TS/language-service/commit/77906a97d9b51f10923e1efba2132227bcdcc660) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix the class self mismatch diagnostic so it also reports invalid `ServiceMap.Service` self type parameters.

- [#691](https://github.com/Effect-TS/language-service/pull/691) [`0e16db0`](https://github.com/Effect-TS/language-service/commit/0e16db0d0e233d58495cce3647c919ba45fb4d56) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Include start and end in json diagnostics command

## 0.81.0

### Minor Changes

- [#684](https://github.com/Effect-TS/language-service/pull/684) [`d8d472e`](https://github.com/Effect-TS/language-service/commit/d8d472e640bf737bd7bc2e8b698771dbe6daf940) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve setup diagnostic configuration with grouped preview-driven metadata, richer interactive prompt rendering, and support for tsconfig files without compilerOptions.

- [#685](https://github.com/Effect-TS/language-service/pull/685) [`d94f4ad`](https://github.com/Effect-TS/language-service/commit/d94f4ad6dbe8282726b523e086308cc9957b3667) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add a diagnostic for global `fetch` usage that recommends the Effect HTTP client and include preview fixtures covering both direct and shadowed fetch calls.

### Patch Changes

- [#686](https://github.com/Effect-TS/language-service/pull/686) [`5f76175`](https://github.com/Effect-TS/language-service/commit/5f7617515cc412236318e6cf7c4a57ca06e553cf) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Extend the node built-in import diagnostic to also recommend the Effect HTTP client for `http` and `https` imports.

- [#682](https://github.com/Effect-TS/language-service/pull/682) [`75e1cbe`](https://github.com/Effect-TS/language-service/commit/75e1cbef8e56e66667edd7f2ce0a3f20208e26bd) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add diagnostic groups to rule metadata and render the README diagnostics table grouped by those sections.

## 0.80.0

### Minor Changes

- [#681](https://github.com/Effect-TS/language-service/pull/681) [`1017a54`](https://github.com/Effect-TS/language-service/commit/1017a5443b2e6919f18e57afb86373ba825037c9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Generate a root `schema.json` for `tsconfig.json` plugin configuration, add typed Effect Language Service plugin options to that schema, and have `effect-language-service setup` add or remove the matching `$schema` entry automatically.

- [#679](https://github.com/Effect-TS/language-service/pull/679) [`3664197`](https://github.com/Effect-TS/language-service/commit/3664197f271012d001f6074d40c5303826d632ce) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add inline `--lspconfig` support to the `effect-language-service diagnostics` CLI command so diagnostics runs can override the project plugin configuration without editing `tsconfig.json`.

## 0.79.0

### Minor Changes

- [#671](https://github.com/Effect-TS/language-service/pull/671) [`6b9c378`](https://github.com/Effect-TS/language-service/commit/6b9c378c4e1d0c83e4afe322cf44ccacd75d1cb4) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add the `extendsNativeError` diagnostic to warn when classes directly extend the native `Error` constructor, including common local aliases such as `const E = Error`.

  This helps steer users toward tagged errors that preserve stronger typing in the Effect failure channel.

- [#678](https://github.com/Effect-TS/language-service/pull/678) [`0e9c11b`](https://github.com/Effect-TS/language-service/commit/0e9c11b4b3c076adef62e31722855ebc0071aaf6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Generate the README diagnostics table from the diagnostic registry.

  Each diagnostic now declares:

  - whether it is fixable
  - which Effect versions it supports

  The generated table is checked in CI, and diagnostics tests verify that `fixable` matches the presence of non-suppression quick fixes.

- [#676](https://github.com/Effect-TS/language-service/pull/676) [`2f982d6`](https://github.com/Effect-TS/language-service/commit/2f982d69541633aca2cd3bcdc89bdae7d17cb97b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add the `nodeBuiltinImport` diagnostic to warn when importing Node.js built-in modules (`fs`, `path`, `child_process`) that have Effect-native counterparts in `@effect/platform`.

  This diagnostic covers ES module imports and top-level `require()` calls, matching both bare and `node:`-prefixed specifiers as well as subpath variants like `fs/promises`, `path/posix`, and `path/win32`. It defaults to severity `off` and provides no code fixes.

- [#673](https://github.com/Effect-TS/language-service/pull/673) [`f9e24df`](https://github.com/Effect-TS/language-service/commit/f9e24df5db70110d5e84da45810bd82cf12fadc7) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add plugin options to better control patched `tsc` behavior.

  `ignoreEffectErrorsInTscExitCode` allows Effect diagnostics reported as errors to be ignored for exit-code purposes, and `skipDisabledOptimiziation` keeps disabled diagnostics eligible for comment-based overrides when patch mode is active.

- [#674](https://github.com/Effect-TS/language-service/pull/674) [`54e8c16`](https://github.com/Effect-TS/language-service/commit/54e8c16865e99be9b6faec3e50c17d1e501242f9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add the `serviceNotAsClass` diagnostic to warn when `ServiceMap.Service` is used as a variable assignment instead of in a class declaration.

  Includes an auto-fix that converts `const Config = ServiceMap.Service<Shape>("Config")` to `class Config extends ServiceMap.Service<Config, Shape>()("Config") {}`.

### Patch Changes

- [#675](https://github.com/Effect-TS/language-service/pull/675) [`d1f09c3`](https://github.com/Effect-TS/language-service/commit/d1f09c364bde5a14905b4a9d030830309b6aab43) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Rename the `skipDisabledOptimiziation` plugin option to `skipDisabledOptimization`.

  Example:

  ```json
  {
    "compilerOptions": {
      "plugins": [
        {
          "name": "@effect/language-service",
          "skipDisabledOptimization": true
        }
      ]
    }
  }
  ```

## 0.78.0

### Minor Changes

- [#663](https://github.com/Effect-TS/language-service/pull/663) [`0e82d43`](https://github.com/Effect-TS/language-service/commit/0e82d437e91fe0b98c51b4b53c8d06f29aa41b8e) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve `effectFnOpportunity` inferred span naming for service-layer methods and align examples for Effect v4.

  The inferred span can now include service + method names (for example `MyService.log`) when the convertible function is a method inside a layer service object for strict supported patterns like:

  - `Layer.succeed(Service)(...)`
  - `Layer.sync(Service)(...)`
  - `Layer.effect(Service)(Effect.gen(...))`
  - `Layer.effect(Service, Effect.gen(...))`

  Also add Effect v4 diagnostics fixtures for:

  - `effectFnOpportunity_inferred.ts`
  - `effectFnOpportunity_inferredLayer.ts`

- [#669](https://github.com/Effect-TS/language-service/pull/669) [`a010a29`](https://github.com/Effect-TS/language-service/commit/a010a29d219a22da2553d82da3bbabc3312106f5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add a new `effectInFailure` diagnostic that warns when an `Effect` computation appears in the failure channel (`E`) of another `Effect`.

  The rule traverses Effect-typed expressions, unrolls union members of `E`, and reports when any member is itself a strict Effect type.

  It prefers innermost matches for nested cases (for example nested `Effect.try` in `catch`) to avoid noisy parent reports.

### Patch Changes

- [#666](https://github.com/Effect-TS/language-service/pull/666) [`06b3a6c`](https://github.com/Effect-TS/language-service/commit/06b3a6ce41c24459120c6a396804dadaf420786a) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix `effectFnOpportunity` inferred span naming for `Layer.*(this, ...)` patterns in class static members.

  When the inferred layer target is `this`, the diagnostic now uses the nearest enclosing class name (for example `MyService`) instead of the literal `this` token.

- [#665](https://github.com/Effect-TS/language-service/pull/665) [`a95a679`](https://github.com/Effect-TS/language-service/commit/a95a6792e313ac920f6621858439b18d52c9c0d9) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve yield-based diagnostics and hover behavior by introducing `effectYieldableType` in `TypeParser` and using it in `missingReturnYieldStar`.

  - In Effect v4, yieldable values are recognized through `asEffect()` and mapped to Effect `A/E/R`.
  - In Effect v3, `effectYieldableType` falls back to standard `effectType` behavior.
  - `missingReturnYieldStar` now correctly handles yieldable values such as `Option.none()`.
  - Hover support for `yield*` was updated to use yieldable parsing paths.

- [#664](https://github.com/Effect-TS/language-service/pull/664) [`934ef7e`](https://github.com/Effect-TS/language-service/commit/934ef7e0b58bc5260425b47a9efe1f4d0ccc26f0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Improve `missingReturnYieldStar` safety by targeting only expression statements with top-level `yield*` expressions and validating the enclosing `Effect.gen` scope via `findEnclosingScopes`.

  This avoids edge cases where nested or wrapped `yield*` expressions could be matched incorrectly.

- [#661](https://github.com/Effect-TS/language-service/pull/661) [`0f92686`](https://github.com/Effect-TS/language-service/commit/0f92686ac86b4f90eea436c542914ce59c39afb6) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Update effect dependency to v4.0.0-beta.19 and fix compatibility issues:

  - Fix `layerMagic` refactor producing `any` types in Layer channels by replacing `Array.partition` (which now uses the v4 `Filter.Filter` API) with a native loop for boolean partition logic
  - Add v4 Layer type detection shortcut using `"~effect/Layer"` TypeId property, matching the pattern already used for Effect type detection
  - Mark `Effect.filterMap` as unchanged in the outdated API migration database since it was re-added in v4

## 0.77.0

### Minor Changes

- [#655](https://github.com/Effect-TS/language-service/pull/655) [`c875de2`](https://github.com/Effect-TS/language-service/commit/c875de2c2334f740155f5a1e8a1a44636506d157) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `outdatedApi` diagnostic that warns when using outdated Effect APIs in a project targeting a newer version of Effect.

### Patch Changes

- [#660](https://github.com/Effect-TS/language-service/pull/660) [`99a97a6`](https://github.com/Effect-TS/language-service/commit/99a97a6a4e275d03562de7ede2a2510f1c06f230) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Dispose TypeScript language services in tests to prevent resource leaks

  Added `languageService.dispose()` calls via `try/finally` patterns to all test files that create language services through `createServicesWithMockedVFS()`. This ensures proper cleanup of TypeScript compiler resources after each test completes, preventing memory leaks during test runs.

- [#658](https://github.com/Effect-TS/language-service/pull/658) [`0154667`](https://github.com/Effect-TS/language-service/commit/0154667a23c95a8133751b3454b9233ddc39d8e3) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix outdated API diagnostic for Effect v4 compatibility

  - Fixed `TaggedError` completion to use `TaggedErrorClass` matching the v4 API
  - Removed `Schema.RequestClass` examples that no longer exist in v4
  - Updated Effect v4 harness to latest version

- [#659](https://github.com/Effect-TS/language-service/pull/659) [`2699a80`](https://github.com/Effect-TS/language-service/commit/2699a80e3ecbce91db269cd34689752950d8d278) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add support for `Model.Class` from `effect/unstable/schema` in completions and diagnostics.

  The `classSelfMismatch` diagnostic now detects mismatched Self type parameters in `Model.Class` declarations, and the autocomplete for Self type in classes now suggests `Model.Class` when typing after `Model.`.

  ```ts
  import { Model } from "effect/unstable/schema";

  // autocomplete triggers after `Model.`
  export class MyDataModel extends Model.Class<MyDataModel>("MyDataModel")({
    id: Schema.String,
  }) {}
  ```

## 0.76.0

### Minor Changes

- [#651](https://github.com/Effect-TS/language-service/pull/651) [`aeab349`](https://github.com/Effect-TS/language-service/commit/aeab349b498c5bea4d050409a57f8f1900190c39) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add refactor to convert `Effect.Service` to `Context.Tag` with a static `Layer` property.

  Supports all combinator kinds (`effect`, `scoped`, `sync`, `succeed`) and `dependencies`. The refactor replaces the `Effect.Service` class declaration with a `Context.Tag` class that has a `static layer` property using the corresponding `Layer` combinator.

  Before:

  ```ts
  export class MyService extends Effect.Service<MyService>()("MyService", {
    effect: Effect.gen(function* () {
      return { value: "hello" };
    }),
  }) {}
  ```

  After:

  ```ts
  export class MyService extends Context.Tag("MyService")<
    MyService,
    { value: string }
  >() {
    static layer = Layer.effect(
      this,
      Effect.gen(function* () {
        return { value: "hello" };
      })
    );
  }
  ```

- [#654](https://github.com/Effect-TS/language-service/pull/654) [`2c93eab`](https://github.com/Effect-TS/language-service/commit/2c93eabfd7b799543832dc84304f20c90382c7eb) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Migrate internal Effect dependency from v3 to v4. This updates all CLI and core modules to use the Effect v4 API while maintaining full backward compatibility with existing functionality.

## 0.75.1

### Patch Changes

- [#647](https://github.com/Effect-TS/language-service/pull/647) [`489e3f0`](https://github.com/Effect-TS/language-service/commit/489e3f05727ded4bf62585042135a0b5cec1068b) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Expose diagnostic quick fixes as refactoring actions to work around TypeScript's limited quick fix handling in some contexts

- [#650](https://github.com/Effect-TS/language-service/pull/650) [`6f568cf`](https://github.com/Effect-TS/language-service/commit/6f568cf37a76b23a1a864c4852250f62083379ad) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix TypeParser to skip types with generic call signatures. When parsing covariant, contravariant, or invariant types, signatures with type parameters are now correctly rejected instead of being treated as concrete types.

- [#649](https://github.com/Effect-TS/language-service/pull/649) [`5858fd1`](https://github.com/Effect-TS/language-service/commit/5858fd1d87a4cc1e16f0f1bdb69532b2a1fefac0) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Performance improvements: replace `Nano.gen` with `Nano.fn` named functions across diagnostics, refactors, and code generation modules for better performance tracking and reduced runtime overhead. Add conditional `debugPerformance` flag to avoid unnecessary timing collection when not debugging.

## 0.75.0

### Minor Changes

- [#645](https://github.com/Effect-TS/language-service/pull/645) [`a8a7d33`](https://github.com/Effect-TS/language-service/commit/a8a7d33f3a4ff0762c18c0858084f61e149da33f) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add `ServiceMap.Service` class completion for Effect v4, and fix Schema class completions for v4 (`TaggedErrorClass`, `TaggedClass` now available, `ErrorClass` fully-qualified form fixed, `RequestClass` removed)

## 0.74.0

### Minor Changes

- [#641](https://github.com/Effect-TS/language-service/pull/641) [`693e5a5`](https://github.com/Effect-TS/language-service/commit/693e5a5ef2ee184e0a7d72cb3abc8485c2c0f855) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Added Effect v4 support for diagnostics, refactors, and piping features.

  **Diagnostics:**

  - `multipleEffectProvide`: Warns when multiple `Effect.provide` calls are chained, suggesting consolidation
  - `strictEffectProvide`: Warns when using `Effect.provide` with Layer outside of application entry points
  - `missingLayerContext`: Detects missing Layer context requirements
  - `deterministicKeys`: Extended to support `ServiceMap.Service` patterns
  - `leakingRequirements`: Extended to detect leaking requirements in ServiceMap services
  - `schemaSyncInEffect`: Updated with v4-specific method mappings (e.g., `decodeSync` -> `decodeEffect`)

  **Refactors:**

  - `layerMagic`: Automatically compose and build layers based on service dependencies
  - `structuralTypeToSchema`: Convert TypeScript interfaces and type aliases to Effect Schema classes
  - `makeSchemaOpaque`: Enhanced for v4 with support for `Codec`, `DecodingServices`, and `EncodingServices` types
  - `typeToEffectSchema`: Enhanced to support Effect v4 schema patterns

  **Piping:**

  - Added pipe transformation support for Effect v4 including `Effect.fn`, nested pipes, and function call conversions

### Patch Changes

- [#643](https://github.com/Effect-TS/language-service/pull/643) [`68f6d12`](https://github.com/Effect-TS/language-service/commit/68f6d120adb3dbf46593ca125e10a070e41fbc46) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Disable `schemaUnionOfLiterals` diagnostic for Effect v4, as `Schema.Union` of multiple `Schema.Literal` calls is no longer applicable in v4.

## 0.73.1

### Patch Changes

- [#639](https://github.com/Effect-TS/language-service/pull/639) [`ff72045`](https://github.com/Effect-TS/language-service/commit/ff72045531c2b04318b89bb131f131b114b22818) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add wildcard (`*`) support for `@effect-diagnostics` comment directives. You can now use `*` as a rule name to apply a severity override to all diagnostics at once, e.g. `@effect-diagnostics *:off` disables all Effect diagnostics from that point on. Rule-specific overrides still take precedence over wildcard overrides.

## 0.73.0

### Minor Changes

- [#637](https://github.com/Effect-TS/language-service/pull/637) [`616c2cc`](https://github.com/Effect-TS/language-service/commit/616c2cc21c9526da9b97f5c122ef0e2789f9bdff) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Add Effect v4 completions support

  - Detect installed Effect version (v3 or v4) and conditionally enable version-specific completions
  - Add `Schema.ErrorClass` and `Schema.RequestClass` completions for Effect v4
  - Disable v3-only completions (`Effect.Service`, `Effect.Tag`, `Schema.TaggedError`, `Schema.TaggedClass`, `Schema.TaggedRequest`, `Context.Tag` self, `Rpc.make` classes, `Schema.brand`, `Model.Class`) when Effect v4 is detected
  - Support lowercase `taggedEnum` in addition to `TaggedEnum` for v4 API compatibility

## 0.72.1

### Patch Changes

- [#635](https://github.com/Effect-TS/language-service/pull/635) [`b16fd37`](https://github.com/Effect-TS/language-service/commit/b16fd378797be05462ff7a9537a799613abd7be5) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Fix effectGenToFn refactor to convert `Effect<A, E, R>` return types to `Effect.fn.Return<A, E, R>`

  Before this fix, the "Convert to fn" refactor would keep the original `Effect.Effect<A, E, R>` return type, producing code that doesn't compile. Now it correctly transforms the return type:

  ```ts
  // Before refactor
  const someFunction = (value: string): Effect.Effect<number, boolean> =>
    Effect.gen(function* () {
      /* ... */
    });

  // After refactor (fixed)
  const someFunction = Effect.fn("someFunction")(function* (
    value: string
  ): Effect.fn.Return<number, boolean, never> {
    /* ... */
  });
  ```

- [#630](https://github.com/Effect-TS/language-service/pull/630) [`689a012`](https://github.com/Effect-TS/language-service/commit/689a01258a62bda671408045572649936c09ea39) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Restructure test harness setup by moving shared test utilities and updating package dependencies

## 0.72.0

### Minor Changes

- [#627](https://github.com/Effect-TS/language-service/pull/627) [`a34f997`](https://github.com/Effect-TS/language-service/commit/a34f997af3b97f0d97ac755ee044f9653724b7d2) Thanks [@mattiamanzati](https://github.com/mattiamanzati)! - Refactor internal structure and harness
