import { beforeAll, describe, expect, it, vi } from 'vitest'

import { HASH } from '../mocks/fixtures.ts'

type Handler = NonNullable<typeof window.onmessage>

// Run on the page, where coverage can see it: here `self` is the window, so importing the
// worker sets window.onmessage. Take the handler and detach it straight away, so that it
// never sees the messages Vitest itself posts to the page.
let handle: Handler

function post(data: unknown): void {
  handle.call(window, new MessageEvent('message', { data }))
}

describe('worker', () => {
  beforeAll(async () => {
    await import('./worker.ts')
    handle = window.onmessage!
    window.onmessage = null
  })

  it('should reply with the decoded image', () => {
    const reply = vi.spyOn(window, 'postMessage').mockImplementation(() => {})

    post({ id: 'a', blurhash: HASH, width: 32, height: 43 })

    expect(reply).toHaveBeenCalledWith({ id: 'a', image: expect.any(Blob) })
  })

  it('should reply with why the blurhash could not be decoded', () => {
    const reply = vi.spyOn(window, 'postMessage').mockImplementation(() => {})

    post({ id: 'b', blurhash: 'nope', width: 32, height: 32 })

    expect(reply).toHaveBeenCalledWith({
      id: 'b',
      error: 'BlurHashError: The blurhash string must be at least 6 characters',
    })
  })
})
