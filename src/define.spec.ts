import { describe, expect, it } from 'vitest'

import * as define from './define.ts'
import * as index from './index.ts'

describe('@limulus/blur-hash/define', () => {
  it('should define <blur-hash>', () => {
    expect(customElements.get('blur-hash')).toBe(index.BlurHash)
  })

  it('should export what the main entry does', () => {
    expect({ ...define }).toEqual({ ...index })
  })
})
