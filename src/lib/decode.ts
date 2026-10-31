import { decodeBlurHash } from 'fast-blurhash'

import { BlurHashError } from './blur-hash-error.ts'

const BASE83 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

/** Decodes `blurhash` into a `width`×`height` BMP. Throws if `blurhash` isn't valid. */
export function decodeToBmp(blurhash: string, width: number, height: number): Blob {
  validate(blurhash)
  return new Blob([bmp(width, height, decodeBlurHash(blurhash, width, height))], {
    type: 'image/bmp',
  })
}

// fast-blurhash decodes anything without complaint, turning a malformed hash into a black or
// garbled image, so reject what Wolt's reference decoder would have.
function validate(blurhash: string): void {
  if (blurhash.length < 6) {
    throw new BlurHashError('The blurhash string must be at least 6 characters')
  }

  for (const char of blurhash) {
    if (!BASE83.includes(char)) {
      throw new BlurHashError(`The blurhash string contains an invalid character: ${char}`)
    }
  }

  const sizeFlag = BASE83.indexOf(blurhash[0])
  const expected = 4 + 2 * ((sizeFlag % 9) + 1) * (Math.floor(sizeFlag / 9) + 1)
  if (blurhash.length !== expected) {
    throw new BlurHashError(
      `blurhash length mismatch: length is ${blurhash.length} but it should be ${expected}`
    )
  }
}

// An uncompressed 24-bit BMP with its rows top to bottom. BlurHash images are opaque, so the
// alpha channel is dropped. Writing this directly is several times faster than drawing to an
// OffscreenCanvas and encoding a PNG, and needs no canvas at all.
function bmp(
  width: number,
  height: number,
  rgba: Uint8ClampedArray
): Uint8Array<ArrayBuffer> {
  const headerSize = 14 + 40 // BITMAPFILEHEADER + BITMAPINFOHEADER
  const rowSize = (width * 3 + 3) & ~3 // rows are padded to 4 bytes
  const out = new Uint8Array(headerSize + rowSize * height)
  const view = new DataView(out.buffer)

  out[0] = 0x42 // 'B'
  out[1] = 0x4d // 'M'
  view.setUint32(2, out.length, true)
  view.setUint32(10, headerSize, true) // where the pixels start
  view.setUint32(14, 40, true) // BITMAPINFOHEADER size
  view.setInt32(18, width, true)
  view.setInt32(22, -height, true) // negative: rows run top to bottom
  view.setUint16(26, 1, true) // color planes
  view.setUint16(28, 24, true) // bits per pixel; compression and the rest stay 0

  for (let y = 0; y < height; y++) {
    let o = headerSize + y * rowSize
    for (let i = y * width * 4, end = i + width * 4; i < end; i += 4) {
      out[o++] = rgba[i + 2]
      out[o++] = rgba[i + 1]
      out[o++] = rgba[i]
    }
  }

  return out
}
