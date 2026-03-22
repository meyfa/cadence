/**
 * A non-cryptographic random number generator function that returns
 * a floating-point number in the range [0, 1).
 */
export type RandomGenerator = () => number

export function mulberry32 (seed: number): RandomGenerator {
  let a = seed

  // https://github.com/bryc/code/blob/88c1317ea6f9b25c153afa9c369c365fed11b482/jshash/PRNGs.md
  // (public domain)
  return () => {
    a |= 0
    a = a + 0x6D2B79F5 | 0

    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t

    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/**
 * Non-cryptographic hash function that produces seeds for random number generators.
 *
 * @param input The input string to hash
 * @returns A function that generates a sequence of unsigned 32-bit integers based on the input string
 */
export function xmur3 (input: string): RandomGenerator {
  // https://github.com/bryc/code/blob/88c1317ea6f9b25c153afa9c369c365fed11b482/jshash/PRNGs.md#addendum-a-seed-generating-functions
  // (public domain)

  let h = 1779033703 ^ input.length

  for (let i = 0; i < input.length; ++i) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353)
    h = h << 13 | h >>> 19
  }

  return () => {
    h = Math.imul(h ^ h >>> 16, 2246822507)
    h = Math.imul(h ^ h >>> 13, 3266489909)

    return (h ^= h >>> 16) >>> 0
  }
}
