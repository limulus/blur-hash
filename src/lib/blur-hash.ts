import { BlurHashError } from './blur-hash-error.ts'

export interface BlurHashDecodeMessage {
  id: string
  blurhash: string
  width: number
  height: number
}

/** The decoded image, or why decoding failed. */
export type BlurHashDecodeResultMessage = { id: string } & (
  { image: Blob } | { error: string }
)

// Placeholders are never revoked or evicted, since any later element may need the same one;
// each is 3 to 12 KB.
const cache = new Map<string, Promise<string | undefined>>()
// Resolves the decode with each id when the worker replies.
const pending = new Map<string, (result: BlurHashDecodeResultMessage) => void>()
// `null` if the worker couldn't be constructed, so that it isn't tried again.
let worker: Worker | null | undefined

// The background-size that draws the placeholder where each object-fit draws the image.
// `none` draws the image at its natural size, which isn't known until it loads; if the
// photo is bigger than its box, cover is the closest match.
const backgroundSizes: Record<string, string> = {
  fill: '100% 100%',
  contain: 'contain',
  'scale-down': 'contain',
  cover: 'cover',
  none: 'cover',
}

/**
 * Paints a BlurHash placeholder as the background image of the `<img>` it wraps, until
 * that image loads:
 *
 * ```html
 * <blur-hash blurhash="LFG8o]yV?tnO}n%fS0xGx]oynPWA" width="3024" height="4032">
 *   <img src="photo.jpeg" width="3024" height="4032" alt="…" />
 * </blur-hash>
 * ```
 */
export class BlurHash extends HTMLElement {
  /**
   * Where to load the decode worker from. Leave unset if your bundler handles
   * `new Worker(new URL('./worker.js', import.meta.url))`; otherwise bundle
   * `@limulus/blur-hash/worker` and set its URL here. It's read when the first placeholder
   * is decoded.
   */
  static workerUrl: string | URL | undefined

  /** Defines the element as `name`, unless that name is already taken. */
  static define(name = 'blur-hash'): void {
    if (!customElements.get(name)) {
      customElements.define(name, this)
    }
  }

  #observer: MutationObserver | undefined

  connectedCallback(): void {
    if (this.#tryPlacehold()) {
      return
    }

    // The HTML parser connects an already-defined element as soon as it reads the start
    // tag, before any of its children exist, so wait for the <img> to be parsed.
    this.#observer = new MutationObserver(() => {
      this.#tryPlacehold()
    })
    this.#observer.observe(this, { childList: true, subtree: true })
  }

  disconnectedCallback(): void {
    this.#stopObserving()
  }

  #stopObserving(): void {
    this.#observer?.disconnect()
    this.#observer = undefined
  }

  /** Placeholds the `<img>` if it has been parsed, and returns whether it had. */
  #tryPlacehold(): boolean {
    const imgEl = this.querySelector('img')
    if (!imgEl) {
      return false
    }

    // Stop first, so that invalid attributes throw once, not on every later mutation.
    this.#stopObserving()
    this.#placehold(imgEl)
    return true
  }

  #placehold(imgEl: HTMLImageElement): void {
    const blurhash = this.getAttribute('blurhash')
    const width = parseInt(this.getAttribute('width') ?? '0', 10)
    const height = parseInt(this.getAttribute('height') ?? '0', 10)

    if (!blurhash) {
      throw new BlurHashError('No blurhash attribute found')
    }

    // Negated so that NaN, from a missing or non-numeric attribute, fails too.
    if (!(width > 0 && height > 0)) {
      throw new BlurHashError('The width and height attributes must be positive numbers')
    }

    // Don't apply blurhash if the image is already loaded
    if (isLoaded(imgEl)) {
      return
    }

    // Named functions, not closures: adding the same listener again is a no-op, so if the
    // element is moved and connects again, its listeners don't stack up.
    imgEl.addEventListener('load', clearPlaceholder)
    imgEl.addEventListener('error', showAltText)

    const { workerUrl } = this.constructor as typeof BlurHash
    void placeholderUrl(blurhash, width, height, workerUrl).then((blobUrl) => {
      // If the image loaded while the worker was decoding, the load listener above had
      // nothing to clear yet, and painting now would leave the placeholder behind it.
      if (blobUrl === undefined || isLoaded(imgEl)) {
        return
      }

      const { objectFit, objectPosition } = getComputedStyle(imgEl)
      Object.assign(imgEl.style, {
        backgroundImage: `url(${blobUrl})`,
        backgroundSize: backgroundSizes[objectFit],
        backgroundPosition: objectPosition,
        backgroundRepeat: 'no-repeat',
      })

      // Hide alt text that Firefox displays while loading images because we can't know if
      // the text will be legible atop the blurhash background. If the image has already
      // failed, its error event fired before there was anything to restore.
      if (!isBroken(imgEl)) {
        imgEl.style.color = 'transparent'
      }
    })
  }
}

// Safari seems to sometimes calculate object-fit images differently than the background
// image, which can lead to the background image peeking through on the edges. We don't need
// to keep these blur hash images around if they are not being displayed, so we may as well
// remove them.
function clearPlaceholder(this: HTMLImageElement): void {
  // Attempt to prevent flash caused by removing the background image before the image is
  // rendered
  requestAnimationFrame(() => {
    Object.assign(this.style, {
      backgroundImage: '',
      backgroundSize: '',
      backgroundPosition: '',
      backgroundRepeat: '',
      color: '',
    })
  })
}

// A broken image's alt text is all that describes it, so let the browser draw it.
function showAltText(this: HTMLImageElement): void {
  this.style.color = ''
}

function isLoaded(imgEl: HTMLImageElement): boolean {
  return imgEl.complete && imgEl.naturalWidth > 0
}

// An <img> without a source is also complete with no width, but it has no currentSrc.
function isBroken(imgEl: HTMLImageElement): boolean {
  return imgEl.complete && imgEl.naturalWidth === 0 && imgEl.currentSrc !== ''
}

/** Resolves with a blob URL for the placeholder, or `undefined` if it couldn't be decoded. */
function placeholderUrl(
  blurhash: string,
  width: number,
  height: number,
  workerUrl: string | URL | undefined
): Promise<string | undefined> {
  // Make the short side 32 px, unless that would make the long side more than 128 px.
  // Otherwise an extreme aspect ratio would have the worker decode an enormous image.
  const scale = Math.min(32 / Math.min(width, height), 128 / Math.max(width, height))
  const scaledWidth = Math.max(1, Math.round(width * scale))
  const scaledHeight = Math.max(1, Math.round(height * scale))

  const id = `${blurhash}-${scaledWidth}-${scaledHeight}`
  let blobUrl = cache.get(id)

  if (!blobUrl) {
    const message: BlurHashDecodeMessage = {
      id,
      blurhash,
      width: scaledWidth,
      height: scaledHeight,
    }
    blobUrl = new Promise<BlurHashDecodeResultMessage>((resolve) => {
      if (worker === undefined) worker = createWorker(workerUrl)
      if (worker) {
        pending.set(id, resolve)
        worker.postMessage(message)
      }
    }).then((result) => {
      if ('error' in result) {
        console.error(`BlurHash: Could not decode "${blurhash}": ${result.error}`)
        return undefined
      }
      return URL.createObjectURL(result.image)
    })
    cache.set(id, blobUrl)
  }

  return blobUrl
}

/** Starts the decode worker, or returns `null` if it can't be constructed. */
function createWorker(workerUrl: string | URL | undefined): Worker | null {
  let decoder: Worker
  try {
    // Spelled out in full so that bundlers which recognize this pattern bundle the worker.
    decoder =
      workerUrl === undefined
        ? new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
        : new Worker(workerUrl, { type: 'module' })
  } catch (error) {
    // Chromium throws here for a cross-origin worker, such as one loaded from a CDN, where
    // other browsers fire the error event below instead.
    reportWorkerFailure(error)
    return null
  }

  decoder.addEventListener(
    'message',
    ({ data }: MessageEvent<BlurHashDecodeResultMessage>) => {
      pending.get(data.id)!(data)
      pending.delete(data.id)
    }
  )

  // If the worker fails to load, nothing else reports it in the console. That's what
  // happens with bundlers that leave the URL above alone, like esbuild and plain Rollup.
  decoder.addEventListener('error', reportWorkerFailure)

  return decoder
}

function reportWorkerFailure(cause: unknown): void {
  console.error(
    "BlurHash: The decode worker couldn't start, so no placeholders will be shown. If your " +
      "bundler doesn't bundle it, or you load this package from a CDN, see " +
      'BlurHash.workerUrl in the README.',
    cause
  )
}
