import { describe, expect, it } from 'vitest'
import { formatByteSize, isMemoryFailure, MOBILE_DRAWING_LIMIT_BYTES } from './limits'

describe('mobile drawing limits', () => {
  it('formats sizes the way the error toast shows them', () => {
    expect(formatByteSize(2048)).toBe('2 KB')
    expect(formatByteSize(MOBILE_DRAWING_LIMIT_BYTES)).toBe('96.0 MB')
  })

  it('recognizes WebView allocation failures', () => {
    expect(isMemoryFailure(new RangeError('Array buffer allocation failed'))).toBe(true)
    expect(isMemoryFailure(new Error('Could not parse header'))).toBe(false)
  })
})
