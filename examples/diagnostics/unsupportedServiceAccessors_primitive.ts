import * as Effect from "effect/Effect"

export class ValidService extends Effect.Tag("ValidService")<ValidService, string>() {
}

export class ValidService2 extends Effect.Tag("ValidService2")<ValidService2, number>() {
}

export class ValidService3 extends Effect.Tag("ValidService3")<ValidService3, string | number>() {
}

export class ValidService4 extends Effect.Tag("ValidService4")<ValidService4, "production" | "development">() {
}

export class ValidService5 extends Effect.Tag("ValidService5")<ValidService5, 42>() {
}
