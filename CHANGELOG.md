# @effect/language-service

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
