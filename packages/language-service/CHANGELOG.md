# @effect/language-service

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
