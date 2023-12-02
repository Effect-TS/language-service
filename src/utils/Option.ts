export type None = {
  readonly _tag: "None"
}

export type Some<A> = {
  readonly _tag: "Some"
  readonly value: A
}

export type Option<A> = None | Some<A>

export const none: Option<never> = { _tag: "None" }

export const some: <A>(a: A) => Option<A> = (value) => ({
  _tag: "Some",
  value
})

export const isNone = <A>(fa: Option<A>): fa is None => fa._tag === "None"

export const isSome = <A>(fa: Option<A>): fa is Some<A> => fa._tag === "Some"

export const map = <A, B>(f: (a: A) => B) => (self: Option<A>): Option<B> =>
  isNone(self) ? none : some(f(self.value))

export const fromNullable = <A>(fa: null | undefined | A): Option<A> =>
  typeof fa === "undefined" || fa === null ? none : some(fa)

export const orElse = <B>(alt: Option<B>) => <A>(self: Option<A>): Option<A | B> =>
  isNone(self) ? alt : self

export const getOrElse = <A>(alt: () => A) => (self: Option<A>): A =>
  isNone(self) ? alt() : self.value

export const flatMap = <A, B>(fn: (a: A) => Option<B>) => (self: Option<A>): Option<B> =>
  isNone(self) ? self : fn(self.value)
