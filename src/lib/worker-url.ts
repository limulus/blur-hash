/**
 * The decode worker beside the module at `moduleUrl`, if that module is on another origin,
 * as it is when this package is loaded unbundled from a CDN. Otherwise `undefined`.
 */
export function crossOriginWorkerUrl(moduleUrl: string): URL | undefined {
  const url = new URL('./worker.js', moduleUrl)
  return isCrossOrigin(url) ? url : undefined
}

/**
 * The URL to start a worker from. Browsers only start workers from the page's origin, so if
 * `url` is on another origin, this is a `blob:` URL for a module that imports it.
 */
export function startableWorkerUrl(url: URL): URL | string {
  if (!isCrossOrigin(url)) {
    return url
  }
  const source = `import ${JSON.stringify(url.href)}`
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
}

// Only http(s) counts: webpack makes `import.meta.url` a file: URL, and the worker it bundles
// is on the page's origin.
function isCrossOrigin(url: URL): boolean {
  return /^https?:$/.test(url.protocol) && url.origin !== location.origin
}
