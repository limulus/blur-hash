# @limulus/blur-hash

Web component to render [BlurHash](https://blurha.sh/) placeholders as background images of
`<img>` elements.

![limulus.net/photos loading over a slowed connection: each image’s tile shows the blurred placeholder until the photo loads](docs/demo.gif)

## Installation

```sh
npm install @limulus/blur-hash
```

## Usage

Import and automatically define the `<blur-hash>` custom element:

```javascript
import '@limulus/blur-hash/define'
```

This package makes use of a web worker for BlurHash decoding and creation of BMP blobs.
Check that your bundler has support for web workers or use a plugin that adds support.

Wrap your images in `<blur-hash>`, giving it the image’s BlurHash and the image’s full
dimensions:

```html
<blur-hash blurhash="LFG8o]yV?tnO}n%fS0xGx]oynPWA" width="3024" height="4032">
  <img src="photo.jpeg" width="3024" height="4032" alt="…" />
</blur-hash>
```

If you are wondering why `<blur-hash>` does not simply use the dimensions from the `<img>`
element, it’s because it needs the aspect ratio of the image — not its rendered box
dimensions.

## Rationale

The approach this package takes to make use of `background-image` for the BlurHash
placeholder may seem less than ideal. However, this approach trades the potential to animate
a transition from placeholder to image for fewer potential bugs doing element or `src`
replacement.

Using a worker for BlurHash rendering is a trade-off as well. A `<blur-hash>` will never
block the main JS thread, but it does mean that images may load without a placeholder ever
being seen by the user. This introduces inconsistency, but it also ensures that the user
never waits for an image.

## API

### `BlurHash.define(name = 'blur-hash')`

Defines the element under `name`, unless that name is already defined.

### `BlurHash.workerUrl`

Property specifying the location of the decode worker, as a string or `URL`. Leave it unset
if your bundler bundles the worker. It’s read when the first placeholder is decoded, so set
it before calling `BlurHash.define()`, and import the main `@limulus/blur-hash` rather than
`@limulus/blur-hash/define`.

Browsers only start workers from the page’s origin, so if you load this package from a CDN,
start the worker from a `blob:` URL that imports it. The CDN needs to rewrite bare imports
to URLs, as `esm.sh` does, because the worker imports `fast-blurhash`:

```javascript
import { BlurHash } from 'https://esm.sh/@limulus/blur-hash@1.0.0'

BlurHash.workerUrl = URL.createObjectURL(
  new Blob(["import 'https://esm.sh/@limulus/blur-hash@1.0.0/worker'"], {
    type: 'text/javascript',
  })
)

BlurHash.define()
```

If your page has a Content Security Policy, it needs to allow `blob:` in `worker-src`.

### `BlurHashError`

Thrown if an element’s `blurhash`, `width` or `height` attribute is missing or invalid. If a
BlurHash can’t be decoded, the error logged to the console includes this error’s message.

## License

MIT
