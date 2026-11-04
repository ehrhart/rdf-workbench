import { describe, expect, it, vi } from 'vitest'

import { pollUntilGraphEmpty } from './graph-deletion'

const noopSleep = () => Promise.resolve()

describe('pollUntilGraphEmpty', () => {
  it('resolves once the graph reports zero triples', async () => {
    const onProgress = vi.fn()
    const counts = [42, 17, 0]
    const getCount = vi.fn(() => Promise.resolve(counts.shift() ?? 0))

    await expect(
      pollUntilGraphEmpty({
        uri: 'urn:demo',
        getCount,
        onProgress,
        sleep: noopSleep
      })
    ).resolves.toBeUndefined()

    expect(getCount).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenLastCalledWith({ remaining: 0 })
  })

  it('throws the store error after repeated count failures', async () => {
    const getCount = vi.fn(() =>
      Promise.reject(new Error('fetch failed: store unreachable'))
    )

    await expect(
      pollUntilGraphEmpty({
        uri: 'urn:demo',
        getCount,
        maxAttempts: 240,
        maxConsecutiveFailures: 3,
        sleep: noopSleep
      })
    ).rejects.toThrow('fetch failed: store unreachable')

    expect(getCount).toHaveBeenCalledTimes(3)
  })

  it('keeps polling through a single transient failure', async () => {
    const counts: Array<Promise<number>> = [
      Promise.reject(new Error('transient')),
      Promise.resolve(9),
      Promise.resolve(0)
    ]
    const getCount = vi.fn(() => counts.shift() ?? Promise.resolve(0))

    await expect(
      pollUntilGraphEmpty({
        uri: 'urn:demo',
        getCount,
        maxConsecutiveFailures: 3,
        sleep: noopSleep
      })
    ).resolves.toBeUndefined()

    expect(getCount).toHaveBeenCalledTimes(3)
  })

  it('throws when attempts are exhausted while the graph still has triples', async () => {
    const getCount = vi.fn(() => Promise.resolve(5))

    await expect(
      pollUntilGraphEmpty({
        uri: 'urn:demo',
        getCount,
        maxAttempts: 4,
        sleep: noopSleep
      })
    ).rejects.toThrow('still contains data')

    expect(getCount).toHaveBeenCalledTimes(4)
  })
})
