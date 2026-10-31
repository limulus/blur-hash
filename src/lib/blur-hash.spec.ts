import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { BlurHash, BlurHashError } from '../index.ts'
import {
  BROKEN_PHOTO,
  HASH,
  OTHER_HASH,
  blurHash,
  failed,
  img,
  loaded,
  photoUrl,
  placeholder,
  sizeOf,
} from '../mocks/fixtures.ts'

const background = (imgEl: HTMLImageElement) => imgEl.style.backgroundImage

async function paintedUrl(imgEl: HTMLImageElement): Promise<string> {
  await expect.poll(() => background(imgEl)).toMatch(placeholder)
  return placeholder.exec(background(imgEl))![1]
}

describe('BlurHash', () => {
  beforeAll(() => {
    BlurHash.define()
  })
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  describe('.define()', () => {
    it('should define <blur-hash>', () => {
      expect(customElements.get('blur-hash')).toBe(BlurHash)
    })

    it('should leave a name that is already defined alone', () => {
      class Other extends HTMLElement {}
      customElements.define('other-hash', Other)

      BlurHash.define('other-hash')

      expect(customElements.get('other-hash')).toBe(Other)
    })
  })

  describe('when connected with its <img>', () => {
    it('should paint the placeholder behind the image', async () => {
      const imgEl = img()

      document.body.append(blurHash(undefined, imgEl))

      await expect.poll(() => background(imgEl)).toMatch(placeholder)
    })

    it('should hide alt text while the placeholder shows', async () => {
      const imgEl = img()

      document.body.append(blurHash(undefined, imgEl))

      await expect.poll(() => imgEl.style.color).toBe('transparent')
    })

    it('should clear the placeholder once the image loads', async () => {
      const imgEl = img()
      document.body.append(blurHash(undefined, imgEl))
      await expect.poll(() => background(imgEl)).toMatch(placeholder)

      imgEl.src = await photoUrl()

      await expect.poll(() => background(imgEl)).toBe('')
    })

    it('should clear the placeholder size, position and repeat once the image loads', async () => {
      const imgEl = img()
      document.body.append(blurHash(undefined, imgEl))
      await paintedUrl(imgEl)

      imgEl.src = await photoUrl()

      await expect
        .poll(() => [
          imgEl.style.backgroundSize,
          imgEl.style.backgroundPosition,
          imgEl.style.backgroundRepeat,
        ])
        .toEqual(['', '', ''])
    })

    it('should clear the placeholder once, however often it was moved', async () => {
      const imgEl = img()
      const el = blurHash(undefined, imgEl)
      document.body.append(el)
      await paintedUrl(imgEl)
      // Each append of a connected element disconnects and connects it again.
      document.body.append(el)
      document.body.append(el)
      const frame = vi.spyOn(window, 'requestAnimationFrame')

      imgEl.src = await photoUrl()

      await expect.poll(() => background(imgEl)).toBe('')
      expect(frame).toHaveBeenCalledOnce()
    })

    it('should restore the text color once the image loads', async () => {
      const imgEl = img()
      document.body.append(blurHash(undefined, imgEl))
      await expect.poll(() => imgEl.style.color).toBe('transparent')

      imgEl.src = await photoUrl()

      await expect.poll(() => imgEl.style.color).toBe('')
    })

    it('should not paint a placeholder behind an image that has already loaded', async () => {
      const imgEl = img(await photoUrl())
      await loaded(imgEl)

      document.body.append(blurHash(undefined, imgEl))

      expect(background(imgEl)).toBe('')
      expect(imgEl.style.color).toBe('')
    })
  })

  describe('when connected before its <img> is parsed', () => {
    it('should paint the placeholder once the <img> arrives', async () => {
      const el = blurHash()
      const picture = document.createElement('picture')
      const imgEl = img()

      document.body.append(el)
      el.append(picture)
      await Promise.resolve()
      picture.append(imgEl)

      await expect.poll(() => background(imgEl)).toMatch(placeholder)
    })

    it('should stop waiting for the <img> once disconnected', async () => {
      const el = blurHash()
      const imgEl = img()
      document.body.append(el)

      el.remove()
      el.append(imgEl)

      // This element shares the decode the disconnected one would have used, so once this
      // one paints, the other would have painted too.
      const sentinel = img()
      document.body.append(blurHash(undefined, sentinel))
      await paintedUrl(sentinel)
      expect(background(imgEl)).toBe('')
    })
  })

  describe('when the image fails to load', () => {
    it('should show its alt text again', async () => {
      const imgEl = img()
      document.body.append(blurHash(undefined, imgEl))
      await expect.poll(() => imgEl.style.color).toBe('transparent')

      imgEl.src = BROKEN_PHOTO

      await expect.poll(() => imgEl.style.color).toBe('')
    })

    it('should not hide its alt text when it failed before the placeholder landed', async () => {
      const imgEl = img(BROKEN_PHOTO)
      await failed(imgEl)

      document.body.append(blurHash(undefined, imgEl))

      await paintedUrl(imgEl)
      expect(imgEl.style.color).toBe('')
    })
  })

  describe('when attributes are missing or invalid', () => {
    it('should throw without a blurhash', () => {
      const el = blurHash({ width: '1500', height: '2000' }, img())

      expect(() => {
        el.connectedCallback()
      }).toThrow(new BlurHashError('No blurhash attribute found'))
    })

    it('should throw without a width', () => {
      const el = blurHash({ blurhash: HASH, height: '2000' }, img())

      expect(() => {
        el.connectedCallback()
      }).toThrow(
        new BlurHashError('The width and height attributes must be positive numbers')
      )
    })

    it('should throw without a height', () => {
      const el = blurHash({ blurhash: HASH, width: '1500' }, img())

      expect(() => {
        el.connectedCallback()
      }).toThrow(
        new BlurHashError('The width and height attributes must be positive numbers')
      )
    })

    it('should throw for a negative width', () => {
      const el = blurHash({ blurhash: HASH, width: '-1500', height: '2000' }, img())

      expect(() => {
        el.connectedCallback()
      }).toThrow(
        new BlurHashError('The width and height attributes must be positive numbers')
      )
    })
  })

  describe('when the blurhash cannot be decoded', () => {
    it('should log why and paint nothing', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const imgEl = img()

      document.body.append(
        blurHash({ blurhash: 'nope', width: '1500', height: '2000' }, imgEl)
      )

      await expect.poll(() => error).toHaveBeenCalledOnce()
      expect(error.mock.calls[0][0]).toMatch(/^BlurHash: Could not decode "nope": /)
      expect(background(imgEl)).toBe('')
    })
  })

  describe('placeholder', () => {
    it('should be 32 px wide for a portrait image', async () => {
      const imgEl = img()

      document.body.append(
        blurHash({ blurhash: HASH, width: '1500', height: '2000' }, imgEl)
      )

      expect(await sizeOf(await paintedUrl(imgEl))).toEqual([32, 43])
    })

    it('should be 32 px tall for a landscape image', async () => {
      const imgEl = img()

      document.body.append(
        blurHash({ blurhash: HASH, width: '2000', height: '1500' }, imgEl)
      )

      expect(await sizeOf(await paintedUrl(imgEl))).toEqual([43, 32])
    })

    it('should be at most 128 px on its long side', async () => {
      const imgEl = img()

      document.body.append(
        blurHash({ blurhash: HASH, width: '1000', height: '10000' }, imgEl)
      )

      expect(await sizeOf(await paintedUrl(imgEl))).toEqual([13, 128])
    })

    it('should be at least 1 px on its short side', async () => {
      const imgEl = img()

      document.body.append(blurHash({ blurhash: HASH, width: '1', height: '300' }, imgEl))

      expect(await sizeOf(await paintedUrl(imgEl))).toEqual([1, 128])
    })

    it.each([
      ['fill', '100% 100%'],
      ['contain', 'contain'],
      ['scale-down', 'contain'],
      ['cover', 'cover'],
      ['none', 'cover'],
    ])('should be sized for object-fit: %s as %s', async (objectFit, backgroundSize) => {
      const imgEl = img()
      imgEl.style.objectFit = objectFit

      document.body.append(blurHash(undefined, imgEl))

      await paintedUrl(imgEl)
      expect(imgEl.style.backgroundSize).toBe(backgroundSize)
    })

    it('should be positioned where object-position puts the image', async () => {
      const imgEl = img()
      imgEl.style.objectPosition = 'left top'

      document.body.append(blurHash(undefined, imgEl))

      await paintedUrl(imgEl)
      expect(imgEl.style.backgroundPosition).toBe('0% 0%')
    })

    it('should not repeat', async () => {
      const imgEl = img()

      document.body.append(blurHash(undefined, imgEl))

      await paintedUrl(imgEl)
      expect(imgEl.style.backgroundRepeat).toBe('no-repeat')
    })

    it('should be decoded separately for different blurhashes', async () => {
      const [a, b] = [img(), img()]

      document.body.append(
        blurHash({ blurhash: HASH, width: '1000', height: '1000' }, a),
        blurHash({ blurhash: OTHER_HASH, width: '1000', height: '1000' }, b)
      )

      expect(await paintedUrl(a)).not.toBe(await paintedUrl(b))
    })

    it('should be decoded once for the same blurhash and size', async () => {
      const [a, b] = [img(), img()]

      document.body.append(
        blurHash({ blurhash: OTHER_HASH, width: '1600', height: '900' }, a),
        blurHash({ blurhash: OTHER_HASH, width: '1600', height: '900' }, b)
      )

      expect(await paintedUrl(a)).toBe(await paintedUrl(b))
    })
  })
})
