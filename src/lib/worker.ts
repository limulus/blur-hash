// Types only: importing a value from the element would load it here, where there is no
// HTMLElement to extend.
import type { BlurHashDecodeMessage, BlurHashDecodeResultMessage } from './blur-hash.ts'
import { decodeToBmp } from './decode.ts'

self.onmessage = ({ data }: MessageEvent<BlurHashDecodeMessage>) => {
  let response: BlurHashDecodeResultMessage
  try {
    const image = decodeToBmp(data.blurhash, data.width, data.height)
    response = { id: data.id, image }
  } catch (error) {
    response = { id: data.id, error: String(error) }
  }
  self.postMessage(response)
}
