// 6:20,25:20,45:20,64:20,84:20,100:20
import { Effect, Context } from "effect"
import * as Layer from "effect/Layer"

// this can be converted to a Context.Tag with a static layer property
export class MyService extends Effect.Service<MyService>()("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyService", {
    effect: Effect.gen(function*() {
        return {
            value: "MyService"
        }
    })
}){}

// example result
export class MyServiceAsContextTag extends Context.Tag("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceAsContextTag")<MyServiceAsContextTag, {
    value: string
}>(){
    static layer = Layer.effect(this, Effect.gen(function*(){
        return {
            value: "MyService"
        }
    }))
}

export class MyServiceWithArgs extends Effect.Service<MyServiceWithArgs>()("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceWithArgs", {
    effect: (arg: string) => Effect.gen(function*(){
        return {
            value: arg
        }
    })
}){}

// example result
export class MyServiceWithArgsAsContextTag extends Context.Tag("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceWithArgsAsContextTag")<MyServiceWithArgsAsContextTag, {
    value: string
}>(){
    static layer = (arg: string) => Layer.effect(this, Effect.gen(function*(){
        return {
            value: arg
        }
    }))
}

// there is also a scoped variant, which should behave the same as the effect variant, but uses the scoped combinator.
export class MyServiceWithArgsScoped extends Effect.Service<MyServiceWithArgsScoped>()("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceWithArgsScoped", {
    scoped: (arg: string) => Effect.gen(function*(){
        return {
            value: arg
        }
    })
}){}

export class MyServiceWithArgsScopedAsContextTag extends Context.Tag("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceWithArgsScopedAsContextTag")<MyServiceWithArgsScopedAsContextTag, {
    value: string
}>(){
    static layer = (arg: string) => Layer.scoped(this, Effect.gen(function*(){
        return {
            value: arg
        }
    }))
}

// the sync variant returns the structure directly, without using an intermediate effect
export class MyServiceSync extends Effect.Service<MyServiceSync>()("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceSync", {
    sync: () => {
        return {
            value: "MyService"
        }
    }
}){}

// example result
export class MyServiceSyncAsContextTag extends Context.Tag("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceSyncAsContextTag")<MyServiceSyncAsContextTag, {
    value: string
}>(){
    static layer = Layer.sync(this, () => {
        return {
            value: "MyService"
        }
    })
}

// the succeed variant returns the structure directly, without using an intermediate effect
export class MyServiceSucceed extends Effect.Service<MyServiceSucceed>()("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceSucceed", {
    succeed: {
        value: "MyService"
    }
}){}

// example result
export class MyServiceSucceedAsContextTag extends Context.Tag("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceSucceedAsContextTag")<MyServiceSucceedAsContextTag, {
    value: "MyService"
}>(){
    static layer = Layer.succeed(this, {
        value: "MyService"
    })
}

// all variants support dependencies as well
export class MyServiceWithArgsScopedAndDependencies extends Effect.Service<MyServiceWithArgsScopedAndDependencies>()("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceWithArgsScopedAndDependencies", {
    effect: (arg: string) => Effect.gen(function*(){
        return {
            value: arg
        }
    }),
    dependencies: [MyServiceWithArgsScoped.Default("hello")]
}){}

// example result
export class MyServiceWithArgsScopedAndDependenciesAsContextTag extends Context.Tag("@effect/harness-effect-v3/examples/refactors/effectServiceToClassWithLayer/MyServiceWithArgsScopedAndDependenciesAsContextTag")<MyServiceWithArgsScopedAndDependenciesAsContextTag, {
    value: string
}>(){
    static layer = (arg: string) => Layer.effect(this, Effect.gen(function*(){
        return {
            value: arg
        }
    })).pipe(
        Layer.provide(Layer.mergeAll(MyServiceWithArgsScoped.Default("hello")))
    )
}
