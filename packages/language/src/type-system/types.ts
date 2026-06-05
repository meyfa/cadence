export type Type = FacetType | UnionType

declare const facetDataType: unique symbol

export interface FacetType<Facets extends readonly Facet[] = readonly Facet[]> {
  readonly facets: ReadonlyMap<string, Facet>

  readonly format: () => string
  readonly is: (other: Type) => boolean
  readonly has: (value: Value) => value is ValueForType<FacetType<Facets>>
  readonly of: (...data: DataForFacets<Facets>) => ValueForType<FacetType<Facets>>
  readonly getFacet: (name: string) => Facets[number]
}

export interface UnionType<Members extends readonly FacetType[] = readonly FacetType[]> {
  readonly members: Members

  readonly format: () => string
  readonly is: (other: Type) => boolean
  readonly has: (value: Value) => value is ValueForType<UnionType<Members>>
}

export interface Facet<Name extends string = string, Data = unknown> {
  readonly name: Name
  readonly generics: Generics

  readonly format: () => string
  readonly is: (other: Facet | Type) => boolean
  readonly has: (value: Value) => value is Value<Facet<Name, Data>>
  readonly get: <const V extends Value>(value: V) => SpecificFacetDataForValue<V, Name, Data>

  readonly type: () => FacetType<[Facet<Name, Data>]>

  readonly normalize?: (data: unknown) => Data

  // used for type inference of facet data, not actually present at runtime
  readonly [facetDataType]?: Data
}

export interface Value<Facets extends Facet = Facet> {
  readonly type: FacetType
  readonly data: ReadonlyMap<Facets['name'], unknown>
}

// helper types for facet generics

export type IdentityComparable = string | number | boolean | undefined

export interface CustomComparable {
  readonly checkAssignableFrom: (other: unknown) => boolean
}

export type GenericValue = IdentityComparable | Type | CustomComparable
export type Generics = Readonly<Record<string, GenericValue>>

// inference helpers

export type DataForFacet<F> = F extends { readonly [facetDataType]?: infer Data } ? Data : never

export type DataForFacets<Facets> =
  Facets extends readonly [infer F, ...infer R]
    ? F extends Facet<string, infer Data>
      ? [Data, ...DataForFacets<R>]
      : never
    : []

export type ValueForType<T> =
  T extends FacetType<infer Facets>
    ? Value<Facets[number]>
    : T extends UnionType<infer Members>
      ? ValueForType<Members[number]>
      : never

export type FacetByName<Facets, Name extends string> =
  Extract<Facets, { readonly name: Name }>

export type FacetDataByName<Facets, Name extends string> =
  DataForFacet<FacetByName<Facets, Name>>

type UntypedFacetDataFallback<Facets, Fallback> =
  Facets extends { readonly name: string }
    ? string extends Facets['name']
      ? Fallback
      : never
    : never

export type SpecificFacetDataForValue<V extends Value, Name extends string, Fallback> = V extends Value<infer Facets>
  ? [FacetDataByName<Facets, Name>] extends [never]
      ? UntypedFacetDataFallback<Facets, Fallback>
      : Fallback & FacetDataByName<Facets, Name>
  : Fallback
