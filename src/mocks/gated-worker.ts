// The real decode worker, except that it holds its results until a test posts to the
// 'blur-hash-gate' channel. It posts there itself once it is holding a result. Lets a test
// make an image finish loading while that image's placeholder is still being decoded.
import '../lib/worker.ts'

type Post = (message: unknown) => void
const scope = self as unknown as { postMessage: Post }
const post = scope.postMessage.bind(self)
const gate = new BroadcastChannel('blur-hash-gate')
const held: unknown[] = []
let open = false

scope.postMessage = (message) => {
  if (open) {
    post(message)
    return
  }
  held.push(message)
  gate.postMessage('held')
}

gate.onmessage = () => {
  open = true
  for (const message of held.splice(0)) post(message)
}
