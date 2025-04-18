# @effect/language-service

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
