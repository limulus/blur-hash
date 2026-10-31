/**
 * Thrown when a `<blur-hash>` element's attributes are missing or invalid, and when a
 * BlurHash can't be decoded.
 */
export class BlurHashError extends Error {
  name = 'BlurHashError'
}
