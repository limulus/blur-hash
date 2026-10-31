import type { BlurHash } from '../lib/blur-hash.ts'

export const HASH = 'LFG8o]yV?tnO}n%fS0xGx]oynPWA'
export const OTHER_HASH = 'LGDl~9_NE14n-:RPofxusiIUM|tR'

/** What `style.backgroundImage` looks like once a placeholder is painted. */
export const placeholder = /^url\("(blob:[^"]+)"\)$/

/** An unconnected `<blur-hash>`, with a portrait photo's attributes unless given others. */
export function blurHash(
  attributes: Record<string, string> = { blurhash: HASH, width: '1500', height: '2000' },
  ...children: Node[]
): BlurHash {
  const el = document.createElement('blur-hash') as BlurHash
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value)
  el.append(...children)
  return el
}

/** An `<img>`; without a `src` it never loads, so its placeholder stays. */
export function img(src?: string): HTMLImageElement {
  const imgEl = document.createElement('img')
  if (src !== undefined) imgEl.src = src
  return imgEl
}

/** A blob URL for a small opaque PNG, fresh each call so it is never already cached. */
export async function photoUrl(): Promise<string> {
  const canvas = new OffscreenCanvas(40, 30)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  ctx.fillStyle = '#c03'
  ctx.fillRect(0, 0, 40, 30)
  return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }))
}

/** Resolves once `imgEl` fires `load`. */
export function loaded(imgEl: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    imgEl.addEventListener('load', () => {
      resolve()
    })
  })
}

/** An image URL that fails to decode, so an `<img>` given it fires `error`. */
export const BROKEN_PHOTO = 'data:image/png;base64,bm9wZQ=='

/** Resolves once `imgEl` fires `error`. */
export function failed(imgEl: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    imgEl.addEventListener('error', () => {
      resolve()
    })
  })
}

/** The natural size of the image at `url`. */
export async function sizeOf(url: string): Promise<[number, number]> {
  const imgEl = img(url)
  await imgEl.decode()
  return [imgEl.naturalWidth, imgEl.naturalHeight]
}
