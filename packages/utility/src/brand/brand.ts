/**
 * Defines a branded type from a base type and a unique tag.
 *
 * At runtime, the branded type is just the base type, but at compile time it is treated as a distinct type
 * to circumvent TypeScript's structural typing and provide stronger type safety.
 */
export type Brand<Base, Tag extends string> = Base & { __type__: Tag }
