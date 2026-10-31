import { decodeBlurHash } from 'fast-blurhash'
import { describe, expect, it } from 'vitest'

import { BlurHashError } from './blur-hash-error.ts'
import { decodeToBmp } from './decode.ts'
import { HASH } from '../mocks/fixtures.ts'

async function pixelsOf(image: Blob): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(image)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
}

describe('decodeToBmp()', () => {
  it('should return a BMP', () => {
    expect(decodeToBmp(HASH, 32, 43).type).toBe('image/bmp')
  })

  it('should decode at the given size', async () => {
    const bitmap = await createImageBitmap(decodeToBmp(HASH, 43, 32))

    expect([bitmap.width, bitmap.height]).toEqual([43, 32])
  })

  // 43 px rows need padding to a multiple of 4 bytes; 32 px rows don't.
  it.each([
    [32, 43],
    [43, 32],
  ])('should hold exactly the pixels decoded at %ix%i', async (width, height) => {
    const pixels = await pixelsOf(decodeToBmp(HASH, width, height))

    expect(pixels).toEqual(decodeBlurHash(HASH, width, height))
  })

  describe('when the blurhash is invalid', () => {
    it('should throw for one under 6 characters', () => {
      expect(() => decodeToBmp('nope', 32, 32)).toThrow(
        new BlurHashError('The blurhash string must be at least 6 characters')
      )
    })

    it('should throw for a character outside base 83', () => {
      expect(() => decodeToBmp(`${HASH.slice(0, -1)}!`, 32, 32)).toThrow(
        new BlurHashError('The blurhash string contains an invalid character: !')
      )
    })

    it('should throw for the wrong length', () => {
      expect(() => decodeToBmp(HASH.slice(0, -1), 32, 32)).toThrow(
        new BlurHashError('blurhash length mismatch: length is 27 but it should be 28')
      )
    })
  })
})
