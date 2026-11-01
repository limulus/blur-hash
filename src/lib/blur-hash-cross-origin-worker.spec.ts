import { describe, expect, it } from 'vitest'

import { BlurHash } from '../index.ts'
import { blurHash, img, placeholder } from '../mocks/fixtures.ts'

// Its own file: the worker is created once per page, and this one is on another origin.
describe('BlurHash', () => {
  describe('when workerUrl is on another origin', () => {
    it('should paint the placeholder', async () => {
      // The test server listens on 127.0.0.1, so localhost reaches it from another origin.
      const workerUrl = new URL('./worker.ts', import.meta.url)
      workerUrl.hostname = 'localhost'
      expect(workerUrl.origin).not.toBe(location.origin)
      BlurHash.workerUrl = workerUrl
      BlurHash.define()
      const imgEl = img()

      document.body.append(blurHash(undefined, imgEl))

      await expect.poll(() => imgEl.style.backgroundImage).toMatch(placeholder)
    })
  })
})
