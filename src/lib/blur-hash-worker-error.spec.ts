import { describe, expect, it, vi } from 'vitest'

import { BlurHash } from '../index.ts'
import { blurHash, img } from '../mocks/fixtures.ts'

// Its own file: the worker is created once per page, and this one points it nowhere.
describe('BlurHash', () => {
  describe('when the decode worker fails to load', () => {
    it('should log that no placeholders will be shown', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      BlurHash.workerUrl = '/no-such-worker.js'
      BlurHash.define()

      document.body.append(blurHash(undefined, img()))

      await expect.poll(() => error).toHaveBeenCalledOnce()
      expect(error.mock.calls[0][0]).toMatch(/^BlurHash: The decode worker couldn't start/)
    })
  })
})
