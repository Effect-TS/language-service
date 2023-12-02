import * as O from "./Option.js"

export interface Chunk<A> extends ReadonlyArray<A> {}

export const fromIterable = <A>(values: Iterable<A>): ReadonlyArray<A> => Array.from(values)

export const map = <A, B>(f: (a: A) => B) => (fa: ReadonlyArray<A>): ReadonlyArray<B> => fa.map(f)

export const empty = fromIterable<never>([])

export const isEmpty = <A>(
  self: ReadonlyArray<A>
): boolean => self.length === 0

export const append = <B>(
  last: B
) =>
<A>(self: ReadonlyArray<A>): ReadonlyArray<A | B> => [...self, last] as any

export const concat = <B>(
  last: ReadonlyArray<B>
) =>
<A>(self: ReadonlyArray<A>): ReadonlyArray<A | B> => [...self, ...last] as any

export const reverse = <A>(
  self: ReadonlyArray<A>
): ReadonlyArray<A> => (self.length <= 1 ? self : self.slice().reverse())

export const head = <A>(
  self: ReadonlyArray<A>
): O.Option<A> => self.length === 0 ? O.none : O.some(self[0])

export const filter: {
  <C extends A, B extends A, A = C>(
    refinement: (a: A) => a is B
  ): (self: ReadonlyArray<C>) => ReadonlyArray<B>
  <B extends A, A = B>(predicate: (a: A) => boolean): (self: ReadonlyArray<B>) => ReadonlyArray<B>
} = (f: (a: any) => boolean) => (self: ReadonlyArray<any>) => self.filter(f)

export const join = (
  glue: string
) =>
<A>(self: ReadonlyArray<A>): string => self.join(glue)
