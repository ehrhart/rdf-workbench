import { describe, expect, it } from 'vitest'
import { generateTemporaryPassword } from './temporary-password'

describe('generateTemporaryPassword', () => {
  it('emits four groups of four characters', () => {
    const groups = generateTemporaryPassword().split('-')
    expect(groups).toHaveLength(4)
    for (const group of groups) {
      expect(group).toHaveLength(4)
    }
  })

  it('never emits lookalike characters, which humans dictate or transcribe', () => {
    for (let sample = 0; sample < 1000; sample++) {
      expect(generateTemporaryPassword()).not.toMatch(/[ILOilo01]/)
    }
  })
})
