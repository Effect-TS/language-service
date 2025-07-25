import * as Effect from "effect/Effect"

// valid usage: Effect.Service<ValidServiceSelfParameter> is correct because the Self type parameter is the same as the class name
export class ValidServiceSelfParameter
  extends Effect.Service<ValidServiceSelfParameter>()("ValidServiceSelfParameter", {
    succeed: { value: 1 }
  })
{
}

// invalid usage: Effect.Service<ValidServiceSelfParameter> should be Effect.Service<InvalidServiceSelfParameter> because the Self type parameter is not the same as the class name
export class InvalidServiceSelfParameter
  extends Effect.Service<ValidServiceSelfParameter>()("InvalidServiceSelfParameter", {
    succeed: { value: 1 }
  })
{
}
