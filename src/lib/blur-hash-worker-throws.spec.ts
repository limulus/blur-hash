import { describe, expect, it, vi } from 'vitest'

import { BlurHash } from '../index.ts'
import { OTHER_HASH, blurHash, img } from '../mocks/fixtures.ts'

// Its own file: the worker is created once per page, and this one can't be constructed.
describe('BlurHash', () => {
  describe('when the decode worker cannot be constructed', () => {
    it('should log once that no placeholders will be shown', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      // Not a valid URL, so `new Worker` throws, as Chromium does for a cross-origin one.
      BlurHash.workerUrl = 'http://['
      BlurHash.define()

      document.body.append(
        blurHash(undefined, img()),
        blurHash({ blurhash: OTHER_HASH, width: '1000', height: '1000' }, img())
      )

      expect(error).toHaveBeenCalledOnce()
      expect(error.mock.calls[0][0]).toMatch(/^BlurHash: The decode worker couldn't start/)
    })
  })
})
