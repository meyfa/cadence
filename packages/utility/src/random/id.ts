const urlSafeAlphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'

/**
 * A non-cryptographic, insecure random ID generator using a URL-safe alphabet.
 */
export function randomId (size = 32): string {
  let id = ''
  for (let i = 0; i < size; ++i) {
    id += urlSafeAlphabet[(Math.random() * urlSafeAlphabet.length) | 0]
  }

  return id
}
