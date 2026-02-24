# @effect/language-service

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
