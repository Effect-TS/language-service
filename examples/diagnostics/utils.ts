import type * as Types from "effect/Types"

export const Class = <
  Config extends {
    payload: Record<string, unknown>
    requires?: any
    requestError?: any
  } = { payload: {} }
>() =>
<const Tag extends string>(tag: Tag, _options: {
  readonly primaryKey: (payload: Config["payload"]) => string
}): new(
  args: Types.EqualsWith<
    Config["payload"],
    {},
    void,
    {
      readonly [
        P in keyof Config["payload"] as P extends "_tag" ? never : P
      ]: Config["payload"][P]
    }
  >
) =>
  & { readonly _tag: Tag }
  & { readonly [K in keyof Config["payload"]]: Config["payload"][K] } =>
{
  function Persistable(this: any, props: any) {
    this._tag = tag
    if (props) {
      Object.assign(this, props)
    }
  }
  return Persistable as any
}
