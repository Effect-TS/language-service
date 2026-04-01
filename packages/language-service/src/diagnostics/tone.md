# Effect Diagnostic Tone Review

This file lists Effect diagnostic messages whose wording currently implies recommendation, preference, or obligation in the message text itself.

The proposed rewrites aim to keep the text neutral and factual so severity is communicated by the configured diagnostic level rather than by the phrasing.

## 377001

Previous:

> Effect must be yielded or assigned to a variable. effect(floatingEffect)

Preferred:

> This Effect value is neither yielded nor used in an assignment. effect(floatingEffect)

## 377006

Previous:

> It is recommended to use return yield* for Effects that never succeed to signal a definitive exit point for type narrowing and tooling support. effect(missingReturnYieldStar)

Preferred:

> This Effect never succeeds; using `return yield*` preserves a definitive generator exit point for type narrowing and tooling support. effect(missingReturnYieldStar)

## 377008

Previous:

> When yielding Effects inside Effect.gen, you should use yield* instead of yield. effect(missingStarInYieldEffectGen)

Preferred:

> This uses `yield` for an `Effect` value. `yield*` is the Effect-aware form in this context. effect(missingStarInYieldEffectGen)

## 377009

Previous:

> Looks like the previous effect never fails, so probably this error handling will never be triggered. effect(catchUnfailableEffect)

Preferred:

> The previous Effect does not fail, so this error-handling branch will never run. effect(catchUnfailableEffect)

## 377010

Previous:

> You can use Effect.mapError instead of Effect.catch + Effect.fail to transform the error type. effect(catchAllToMapError)

Preferred:

> `Effect.mapError` expresses the same error-type transformation more directly than `Effect.catch/catchAll` followed by `Effect.fail`. effect(catchAllToMapError)

## 377011

Previous:

> {0}.{1} returns a reusable function that can take arguments, but here it's called immediately. Use Effect.gen instead{2}. effect(effectFnIife)

Preferred:

> `{0}.{1}` returns a reusable function that can take arguments, but it is invoked immediately here. `Effect.gen` represents the immediate-use form for this pattern{2}. effect(effectFnIife)

## 377012

Previous:

> Avoid using try/catch inside Effect generators. Use Effect's error handling mechanisms instead (e.g. Effect.try, Effect.tryPromise, Effect.catch, Effect.catchTag). effect(tryCatchInEffectGen)

Preferred:

> This Effect generator contains `try/catch`; in this context, error handling is expressed with Effect APIs such as `Effect.try`, `Effect.tryPromise`, `Effect.catch`, and `Effect.catchTag`. effect(tryCatchInEffectGen)

## 377014

Previous:

> You are returning an Effect-able type inside a generator function, and will result in nested Effect<Effect<...>>.
> Maybe you wanted to return yield* instead?
> Nested Effect-able types may be intended if you plan to later manually flatten or unwrap this Effect, if so you can safely disable this diagnostic for this line through quickfixes. effect(returnEffectInGen)

Preferred:

> This generator returns an Effect-able value directly, which produces a nested `Effect<Effect<...>>`. If the intended result is the inner Effect value, `return yield*` represents that form. effect(returnEffectInGen)

## 377015

Previous:

> Chained pipe calls can be simplified to a single pipe call. effect(unnecessaryPipeChain)

Preferred:

> This expression contains chained `pipe` calls that can be simplified to a single `pipe` call. effect(unnecessaryPipeChain)

## 377016

Previous:

> Effect.void can be used instead of Effect.succeed(undefined) or Effect.succeed(void 0). effect(effectSucceedWithVoid)

Preferred:

> `Effect.void` represents the same outcome as `Effect.succeed(undefined)` or `Effect.succeed(void 0)`. effect(effectSucceedWithVoid)

## 377018

Previous:

> Effect.asVoid can be used instead to discard the success value. effect(effectMapVoid)

Preferred:

> This expression discards the success value through mapping. `Effect.asVoid` represents that form directly. effect(effectMapVoid)

## 377019

Previous:

> This Effect.fail call uses a yieldable error type as argument. You can yield* the error directly instead. effect(unnecessaryFailYieldableError)

Preferred:

> This `yield* Effect.fail(...)` passes a yieldable error value. `yield*` represent that value directly without wrapping it in `Effect.fail`. effect(unnecessaryFailYieldableError)

## 377021

Previous:

> The 'catch' callback in {0} returns 'unknown'. The catch callback should be used to provide typed errors.
> Consider wrapping unknown errors into Effect's Data.TaggedError for example, or narrow down the type to the specific error raised. effect(unknownInEffectCatch)

Preferred:

> The `catch` callback in `{0}` returns `unknown`, so the Effect error type stays untyped. A specific typed error preserves error-channel information, for example by narrowing the value or wrapping it in `Data.TaggedError`. effect(unknownInEffectCatch)

## 377022

Previous:

> The 'catch' callback in {0} returns global 'Error', which loses type safety as untagged errors merge together. Consider using a tagged error and optionally wrapping the original in a 'cause' property. effect(globalErrorInEffectCatch)

Preferred:

> The `catch` callback in `{0}` returns the global `Error` type. Untagged errors merge together in the Effect error channel and lose type-level distinction; a tagged error preserves that distinction and can wrap the original error in a `cause` property. effect(globalErrorInEffectCatch)

## 377024

Previous:

> Using {0} inside an Effect is not recommended. Effects inside generators can usually just be yielded. effect(runEffectInsideEffect)

Preferred:

> `{0}` is called inside an existing Effect context. Here, the inner Effect can be used directly. effect(runEffectInsideEffect)

## 377025

Previous:

> Using {0} inside an Effect is not recommended. The same runtime should generally be used instead to run child effects.
> Consider extracting the Runtime by using for example Effect.runtime and then use Runtime.{1} with the extracted runtime instead. effect(runEffectInsideEffect)

Preferred:

> `{0}` is called inside an Effect with a separate runtime invocation. In this context, run child Effects with the surrounding runtime, which can be accessed through `Effect.runtime` and `Runtime.{1}`. effect(runEffectInsideEffect)

## 377026

Previous:

> Consider using Effect Schema for JSON operations instead of JSON.parse/JSON.stringify. effect(preferSchemaOverJson)

Preferred:

> This code uses `JSON.parse` or `JSON.stringify`. Effect Schema provides Effect-aware APIs for JSON parsing and stringifying. effect(preferSchemaOverJson)

## 377031

Previous:

> Seems like you are constructing a layer with a scope in the requirements.
> Consider using "scoped" instead to get rid of the scope in the requirements. effect(scopeInLayerEffect)

Preferred:

> This layer construction leaves `Scope` in the requirement set. The scoped API removes `Scope` from the resulting requirements. effect(scopeInLayerEffect)

## 377032

Previous:

> Effect.provide with a Layer should only be used at application entry points. If this is an entry point, you can safely disable this diagnostic. Otherwise, using Effect.provide may break scope lifetimes. Compose all layers at your entry point and provide them at once. effect(strictEffectProvide)

Preferred:

> Effect.provide with a Layer should only be used at application entry points. If this is an entry point, you can safely disable this diagnostic. Otherwise, using Effect.provide may break scope lifetimes. Compose all layers at your entry point and provide them at once. effect(strictEffectProvide)

## 377033

Previous:

> Avoid chaining Effect.provide calls, as this can lead to service lifecycle issues. Instead, merge layers and provide them in a single call. effect(multipleEffectProvide)

Preferred:

> This expression chains multiple `Effect.provide` calls. Providing Layers in multiple calls in a chain can break service lifecycle behavior compared with a single combined provide with merged layers. effect(multipleEffectProvide)

## 377035

Previous:

> This layer provides {0} which is required by another layer in the same Layer.mergeAll call. Layer.mergeAll creates layers in parallel, so dependencies between layers will not be satisfied. Consider moving this layer into a Layer.provideMerge after the Layer.mergeAll. effect(layerMergeAllWithDependencies)

Preferred:

> This `Layer.mergeAll` contains a dependency between merged layers: one layer provides `{0}` and another layer requires it. `Layer.mergeAll` constructs layers in parallel, so intra-merge dependencies are not satisfied. effect(layerMergeAllWithDependencies)

## 377036

Previous:

> Schema.Struct with a _tag field can be simplified to Schema.TaggedStruct to make the tag optional in the constructor. effect(schemaStructWithTag)

Preferred:

> This `Schema.Struct` includes a `_tag` field. `Schema.TaggedStruct` is the tagged-struct form for this pattern and makes the tag optional in the constructor. effect(schemaStructWithTag)

## 377037

Previous:

> Using {0} inside an Effect generator is not recommended. Use Schema.{1} instead to get properly typed error channel. effect(schemaSyncInEffect)

Preferred:

> `{0}` is used inside an Effect generator. `Schema.{1}` preserves the typed Effect error channel for this operation without throwing. effect(schemaSyncInEffect)

## 377038

Previous:

> A Schema.Union of multiple Schema.Literal calls can be simplified to a single Schema.Literal call. effect(schemaUnionOfLiterals)

Preferred:

> This `Schema.Union` contains multiple `Schema.Literal` members and can be simplified to a single `Schema.Literal` call. effect(schemaUnionOfLiterals)

## 377041

Previous:

> Methods of this Service require '{0}' from every caller. This leaks implementation details — resolve these dependencies at Layer creation time. effect(leakingRequirements)

Preferred:

> Methods of this Service require `{0}` from every caller. The requirement becomes part of the public service surface instead of remaining internal to Layer implementation. effect(leakingRequirements)

## 377042

Previous:

> Consider using Schema.is instead of instanceof for Effect Schema types. effect(instanceOfSchema)

Preferred:

> This code uses `instanceof` with an Effect Schema type. `Schema.is` is the schema-aware runtime check for this case. effect(instanceOfSchema)

## 377044

Previous:

> Classes extending Schema must not override the constructor; this is because it silently breaks the schema decoding behaviour. If that's needed, we recommend instead to use a static 'new' method that constructs the instance. effect(overriddenSchemaConstructor)

Preferred:

> This Schema subclass defines its own constructor. For Schema classes, constructor overrides break decoding behavior for the class shape. Custom construction can be expressed through a static `new` method instead. effect(overriddenSchemaConstructor)

## 377046

Previous:

> Self type parameter should be '{0}'. effect(classSelfMismatch)

Preferred:

> The `Self` type parameter for this class should be `{0}`. effect(classSelfMismatch)

## 377047

Previous:

> Can be rewritten as a reusable function: {0}. effect(effectFnOpportunity)

Preferred:

> This expression can be rewritten in the reusable function form `{0}`. effect(effectFnOpportunity)

## 377048

Previous:

> Effect.Service requires the service type to be an object {} and not a primitive type. Consider wrapping the value in an object, or manually using Context.Tag or Effect.Tag if you want to use a primitive instead. effect(nonObjectEffectServiceType)

Preferred:

> `Effect.Service` is declared with a primitive service type. `Effect.Service` models object-shaped services; primitive values use `Context.Tag` or `Effect.Tag` directly. effect(nonObjectEffectServiceType)

## 377049

Previous:

> Key should be '{0}'. effect(deterministicKeys)

Preferred:

> This key does not match the deterministic key for this declaration. The expected key is `{0}`. effect(deterministicKeys)

## 377050

Previous:

> Nested function calls can be converted to pipeable style for better readability; consider using {0}.pipe(...) instead. effect(missedPipeableOpportunity)

Preferred:

> This nested call structure has a pipeable form. `{0}.pipe(...)` represents the same call sequence in pipe style and may be easier to read. effect(missedPipeableOpportunity)

## 377051

Previous:

> Multiple versions of package '{0}' detected: {1}. Consider cleaning up your lockfile, or add '{0}' to allowedDuplicatedPackages to suppress this warning. effect(duplicatePackage)

Suggested:

> Multiple versions of package `{0}` were detected: {1}. Package duplication can change runtime identity and type equality across Effect modules. effect(duplicatePackage)

Preferred:

> Multiple versions of package `{0}` were detected: {1}. Package duplication can change runtime identity and type equality across Effect modules. effect(duplicatePackage)

## 377053

Previous:

> This project targets Effect v4, but is using Effect v3 APIs. To find the correct API to use, consult the Effect v4 documentation for the corresponding v4 replacement. effect(outdatedApi)

Preferred:

> This project targets Effect v4, but this code uses Effect v3 APIs. The referenced API belongs to the v3 surface rather than the configured v4 surface. effect(outdatedApi)

## 377055

Previous:

> Avoid extending the native 'Error' class directly. Consider using a tagged error (e.g. Data.TaggedError) to maintain type safety in the Effect failure channel. effect(extendsNativeError)

Preferred:

> This class extends the native `Error` type directly. Untagged native errors lose distinction in the Effect failure channel. effect(extendsNativeError)

## 377056

Previous:

> ServiceMap.Service should be used in a class declaration instead of as a variable. Use: {0} effect(serviceNotAsClass)

Preferred:

> `ServiceMap.Service` is assigned to a variable here, but this API is intended for a class declaration shape such as `{0}`. effect(serviceNotAsClass)

## 377057

Previous:

> Prefer using {0} from {1} instead of the Node.js '{2}' module. effect(nodeBuiltinImport)

Preferred:

> This module reference uses the `{2}` module, the corresponding Effect API is `{0}` from `{1}`. effect(nodeBuiltinImport)

## 377058

Previous:

> Effect-able {0} must be yielded or assigned to a variable. effect(floatingEffect)

Preferred:

> This Effect-able `{0}` value is neither yielded nor assigned to a variable. effect(floatingEffect)


## 377061

Previous:

> Prefer using HttpClient from {0} instead of the global 'fetch' function. effect(globalFetch)

Preferred:

> This code uses the global `fetch` function, HTTP requests are represented through `HttpClient` from `{0}`. effect(globalFetch)

## 377063

Previous:

> Prefer using HttpClient from {0} instead of the global 'fetch' function inside Effect generators. effect(globalFetchInEffect)

Preferred:

> This Effect code calls the global `fetch` function, HTTP requests in Effect code are represented through `HttpClient` from `{0}`. effect(globalFetchInEffect)

## 377064

Previous:

> Prefer using {0} instead of console.{1}. effect(globalConsole)

Preferred:

> This code uses `console.{1}`, the corresponding Effect logging API is `{0}`. effect(globalConsole)

## 377065

Previous:

> Prefer using {0} instead of console.{1} inside Effect generators. effect(globalConsoleInEffect)

Preferred:

> This Effect code uses `console.{1}`, logging in Effect code is represented through `{0}`. effect(globalConsoleInEffect)

## 377066

Previous:

> Prefer using Clock or DateTime from Effect instead of Date.now(). effect(globalDate)

Preferred:

> This code uses `Date.now()`, time access is represented through `Clock` or `DateTime` from Effect. effect(globalDate)

## 377067

Previous:

> Prefer using Clock or DateTime from Effect instead of Date.now() inside Effect generators. effect(globalDateInEffect)

Preferred:

> This Effect code uses `Date.now()`, time access in Effect code is represented through `Clock` or `DateTime` from Effect. effect(globalDateInEffect)

## 377068

Previous:

> Prefer using DateTime from Effect instead of new Date(). effect(globalDate)

Preferred:

> This code constructs `new Date()`, date values are represented through `DateTime` from Effect. effect(globalDate)

## 377069

Previous:

> Prefer using DateTime from Effect instead of new Date() inside Effect generators. effect(globalDateInEffect)


Preferred:

> This Effect code constructs `new Date()`, date values in Effect code are represented through `DateTime` from Effect. effect(globalDateInEffect)

## 377070

Previous:

> Prefer using the Random service from Effect instead of Math.random(). effect(globalRandom)

Preferred:

> This code uses `Math.random()`, randomness is represented through the Effect `Random` service. effect(globalRandom)

## 377071

Previous:

> Prefer using the Random service from Effect instead of Math.random() inside Effect generators. effect(globalRandomInEffect)


Preferred:

> This Effect code uses `Math.random()`, randomness is represented through the Effect `Random` service. effect(globalRandomInEffect)

## 377072

Previous:

> Prefer using {0} from Effect instead of {1}. effect(globalTimers)

Preferred:

> This code uses `{1}`, the corresponding Effect timer API is `{0}` from Effect. effect(globalTimers)

## 377073

Previous:

> Prefer using {0} from Effect instead of {1} inside Effect generators. effect(globalTimersInEffect)

Preferred:

> This Effect code uses `{1}`, the corresponding timer API in this context is `{0}` from Effect. effect(globalTimersInEffect)

## 377074

Previous:

> Using {0} inside an Effect is not recommended. The same services should generally be used instead to run child effects.
> Consider extracting the current services by using for example Effect.services and then use Effect.{1}With with the extracted services instead. effect(runEffectInsideEffect)

Preferred:

> `{0}` is called inside an Effect with a separate services invocation. In this context, child Effects run with the surrounding services, which can be accessed through `Effect.services` and `Effect.{1}With`. effect(runEffectInsideEffect)

## 377062

Previous:

> Parameter '{0}' implicitly has an 'any' type in Effect.fn/Effect.fnUntraced/Effect.fnUntracedEager. Add an explicit type annotation or provide a contextual function type. effect(effectFnImplicitAny)

Preferred:

> Parameter `{0}` implicitly has type `any` in `Effect.fn`, `Effect.fnUntraced`, or `Effect.fnUntracedEager`. No parameter type is available from an explicit annotation or contextual function type. effect(effectFnImplicitAny)
