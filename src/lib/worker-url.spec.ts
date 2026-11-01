import { describe, expect, it } from 'vitest'

import { crossOriginWorkerUrl, startableWorkerUrl } from './worker-url.ts'

describe('crossOriginWorkerUrl()', () => {
  describe('for a module on another origin', () => {
    it('should be the worker beside it', () => {
      const moduleUrl = 'https://cdn.test/@limulus/blur-hash@1.0.0/es2022/blur-hash.mjs'
      expect(crossOriginWorkerUrl(moduleUrl)?.href).toBe(
        'https://cdn.test/@limulus/blur-hash@1.0.0/es2022/worker.js'
      )
    })
  })

  describe('for a module on the page’s origin', () => {
    it('should be undefined', () => {
      expect(crossOriginWorkerUrl(import.meta.url)).toBeUndefined()
    })
  })

  describe('for a file: URL, as webpack makes import.meta.url', () => {
    it('should be undefined', () => {
      const moduleUrl = 'file:///app/node_modules/@limulus/blur-hash/dist/esm/lib/blur-hash.js'
      expect(crossOriginWorkerUrl(moduleUrl)).toBeUndefined()
    })
  })
})

describe('startableWorkerUrl()', () => {
  describe('for a URL on the page’s origin', () => {
    it('should be the URL itself', () => {
      const url = new URL('/worker.js', location.href)
      expect(startableWorkerUrl(url)).toBe(url)
    })
  })

  describe('for a URL on another origin', () => {
    it('should be a blob: URL for a JavaScript module that imports it', async () => {
      const url = startableWorkerUrl(new URL('https://cdn.test/@limulus/blur-hash@1.0.0/worker'))
      expect(String(url)).toMatch(/^blob:/)

      // Chromium won't start a module worker from a blob without a JavaScript type.
      const res = await fetch(url)
      expect(res.headers.get('Content-Type')).toBe('text/javascript')
      expect(await res.text()).toBe('import "https://cdn.test/@limulus/blur-hash@1.0.0/worker"')
    })
  })
})
