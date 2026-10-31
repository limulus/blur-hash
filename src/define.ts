/**
 * The main entry, with `<blur-hash>` already defined. If you need to set
 * `BlurHash.workerUrl`, import the main entry instead, since elements on the page start
 * decoding as soon as `<blur-hash>` is defined.
 */
import { BlurHash } from './index.ts'

export * from './index.ts'

BlurHash.define()
