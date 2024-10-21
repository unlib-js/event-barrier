import { setTimeout } from 'timers/promises'
import { describe, expect, it } from 'vitest'
import EventBarrier from './EventBarrier'
import { AbortedBySignalError, AbortionError, TimeoutError } from './errors'


function expectOnceEvents(eb: EventBarrier, n: number) {
  expect((eb as any).onceWaitersMap.size).toBe(n)
}

function expectOnEvents(eb: EventBarrier, n: number) {
  expect((eb as any).onWaitersMap.size).toBe(n)
}

function expectOnceWaiters(eb: EventBarrier, event: string, n: number) {
  expect((eb as any).onceWaitersMap.get(event)).toHaveLength(n)
}

function expectOnWaiters(eb: EventBarrier, event: string, n: number) {
  expect((eb as any).onWaitersMap.get(event)).toHaveLength(n)
}

describe('EventBarrier.prototype.onceWaitersMap', () => {
  it('should have correct number of OnceWaiters when all `waitFor` calls are pending', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        await setTimeout(100)
        expect((eb as any).onceWaitersMap.get('foo').length).toBe(4)
        eb.notify('foo', 'bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })()
    ])
    expectOnceEvents(eb, 0)
  })

  it('should have correct number of OnceWaiters when some `waitFor` calls are pending', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        await setTimeout(100)
        eb.notify('foo', 'bar', 2)
        expect((eb as any).onceWaitersMap.get('foo').length).toBe(2)
        await setTimeout(100)
        eb.notify('foo', 'doo', 2)
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 250)).toBe('doo')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 250)).toBe('doo')
      })()
    ])
    expectOnceEvents(eb, 0)
  })
})

describe('EventBarrier.prototype.waitFor', () => {
  it('should throw AbortionError when aborted', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        await setTimeout(100)
        expectOnceWaiters(eb, 'foo', 4)
        eb.notify('foo', 'bar', 2)
        expectOnceWaiters(eb, 'foo', 2)
        await setTimeout(100)
        eb.abort('foo')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      expect(eb.waitFor('foo', 250)).rejects.toThrow(AbortionError),
      expect(eb.waitFor('foo', 250)).rejects.toThrow(AbortionError)
    ])
    expectOnceEvents(eb, 0)
  })

  it('should throw TimeoutError when times out', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        await setTimeout(100)
        eb.notify('foo', 'bar', 2)
      })(),
      expect(eb.waitFor('foo', 10)).rejects.toThrow(TimeoutError),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo', 150)).toBe('bar')
      })(),
      expect(eb.waitFor('foo', 200)).rejects.toThrow(TimeoutError),
      expect(eb.waitFor('foo', 200)).rejects.toThrow(TimeoutError)
    ])
    expectOnceEvents(eb, 0)
  })

  it('should throw errors correctly', async () => {
    const eb = new EventBarrier()
    const ac = new AbortController()
    await Promise.all([
      (async () => {
        await setTimeout(100)
        eb.notify('foo', 'bar', 2)
        ac.abort()
      })(),
      expect(eb.waitFor('foo', 50, ac.signal)).rejects.toThrow(TimeoutError),
      (async () => {
        expect(await eb.waitFor('foo')).toBe('bar')
      })(),
      (async () => {
        expect(await eb.waitFor('foo')).toBe('bar')
      })(),
      expect(eb.waitFor('foo', undefined, ac.signal)).rejects.toThrow(AbortedBySignalError),
      expect(eb.waitFor('foo', undefined, ac.signal)).rejects.toThrow(AbortedBySignalError),
      expect(eb.waitFor('foo', 200, ac.signal)).rejects.toThrow(AbortedBySignalError),
      expect(eb.waitFor('foo', 200)).rejects.toThrow(TimeoutError),
    ])
    expectOnceEvents(eb, 0)
  })
})

describe('EventBarrier.prototype.asIterator', () => {
  const readIter = async (
    eb: EventBarrier,
    count: number,
    options: { timeout?: number, signal?: AbortSignal } = {}
  ) => {
    let i = 0
    try {
      for await (const bar of eb.asIterator<string>('foo', options)) {
        expect(bar).toBe(`bar${i++}`)
      }
    } catch (err) {
      expect(i).toBe(count)
      throw err
    }
  }

  it('should stream intermittent events correctly', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        for (let i = 0; i < 10; i++) {
          await setTimeout(100)
          expectOnEvents(eb, 1)
          eb.notify('foo', `bar${i}`)
        }
        eb.abort('foo', new Error('EOF'))
      })(),
      expect(readIter(eb, 10)).rejects.toThrow('EOF')
    ])
    expectOnEvents(eb, 0)
  })

  it('should stream events burst correctly', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        await setTimeout(100)
        expectOnEvents(eb, 1)
        for (let i = 0; i < 5; i++) {
          eb.notify('foo', `bar${i}`)
        }
        eb.abort('foo')
      })(),
      expect(readIter(eb, 5)).rejects.toThrow(AbortionError)
    ])
    expectOnEvents(eb, 0)
  })

  it('should stream events correctly regardless of how the events arrive', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        await setTimeout(100)
        expectOnWaiters(eb, 'foo', 1)
        for (let i = 0; i < 5; i++) {
          eb.notify('foo', `bar${i}`)
        }
        await setTimeout(100)
        expectOnWaiters(eb, 'foo', 1)
        for (let i = 5; i < 10; i++) {
          expectOnWaiters(eb, 'foo', 1)
          eb.notify('foo', `bar${i}`)
          expectOnWaiters(eb, 'foo', 1)
        }
        eb.abort('foo', new Error('EOF'))
      })(),
      expect(readIter(eb, 10)).rejects.toThrow('EOF')
    ])
    expectOnEvents(eb, 0)
  })

  it('should throw TimeoutError when times out', async () => {
    const eb = new EventBarrier()
    await Promise.all([
      (async () => {
        await setTimeout(50)
        expectOnWaiters(eb, 'foo', 1)
        for (let i = 0; i < 5; i++) {
          await setTimeout(i * 100 + 100)
          eb.notify('foo', `bar${i}`)
        }
      })(),
      expect(readIter(eb, 3, { timeout: 350 })).rejects.toThrow(TimeoutError)
    ])
    expectOnEvents(eb, 0)
  })

  it('should throw AbortedBySignalError when aborted by signal', async () => {
    const eb = new EventBarrier()
    const ac = new AbortController()
    await Promise.all([
      (async () => {
        await setTimeout(50)
        expectOnWaiters(eb, 'foo', 1)
        for (let i = 0; i < 5; i++) {
          eb.notify('foo', `bar${i}`)
        }
        ac.abort()
        expectOnEvents(eb, 0)
        for (let i = 5; i < 10; i++) {
          eb.notify('foo', `bar${i}`)
        }
        expectOnEvents(eb, 0)
      })(),
      expect(readIter(eb, 5, { signal: ac.signal })).rejects.toThrow(AbortedBySignalError)
    ])
    expectOnEvents(eb, 0)
  })
})
