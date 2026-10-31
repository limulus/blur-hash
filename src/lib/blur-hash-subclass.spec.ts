import { describe, expect, it, vi } from 'vitest'

import { BlurHash } from '../index.ts'
import { HASH, img } from '../mocks/fixtures.ts'

// Its own file: the worker is created once per page, and this one points it nowhere.
describe('BlurHash', () => {
  describe('when a subclass sets workerUrl', () => {
    it('should load the decode worker from it', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      class PhotoHash extends BlurHash {}
      PhotoHash.workerUrl = '/no-such-worker.js'
      PhotoHash.define('photo-hash')
      const el = document.createElement('photo-hash')
      el.setAttribute('blurhash', HASH)
      el.setAttribute('width', '1500')
      el.setAttribute('height', '2000')
      el.append(img())

      document.body.append(el)

      await expect.poll(() => error).toHaveBeenCalledOnce()
      expect(error.mock.calls[0][0]).toMatch(/^BlurHash: The decode worker couldn't start/)
    })
  })
})
