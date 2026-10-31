import { describe, expect, it } from 'vitest'

import { BlurHash } from '../index.ts'
import { blurHash, img, loaded, photoUrl, placeholder } from '../mocks/fixtures.ts'

// Its own file: the worker is created once per page, and this one swaps in a gated worker.
describe('BlurHash', () => {
  describe('when the image loads while its placeholder is being decoded', () => {
    it('should not paint the placeholder', async () => {
      const gate = new BroadcastChannel('blur-hash-gate')
      const held = new Promise((resolve) => (gate.onmessage = resolve))
      BlurHash.workerUrl = new URL('../mocks/gated-worker.ts', import.meta.url)
      BlurHash.define()
      const imgEl = img(await photoUrl())
      // This image never loads and shares the decode, so its placeholder shows when the
      // decode has landed.
      const sentinel = img()

      document.body.append(blurHash(undefined, imgEl), blurHash(undefined, sentinel))
      expect(imgEl.complete).toBe(false)
      await Promise.all([loaded(imgEl), held])
      // The element clears the placeholder an animation frame after load; land the decode
      // after that, as a slow decode does.
      await new Promise((resolve) => requestAnimationFrame(resolve))
      gate.postMessage('open')

      await expect.poll(() => sentinel.style.backgroundImage).toMatch(placeholder)
      expect(imgEl.style.backgroundImage).toBe('')
    })
  })
})
