import EventBarrier from '.'
import assert from 'assert'
import { setTimeout } from 'timers/promises'


async function test() {
  const eb = new EventBarrier
  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      assert.strictEqual((eb as any).onceWaitersMap.get('foo').length, 4)
      eb.notify('foo', 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })()
  ]))
  assert.strictEqual((eb as any).onceWaitersMap.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar', 2)
      assert.strictEqual((eb as any).onceWaitersMap.get('foo').length, 2)
      await setTimeout(100)
      eb.notify('foo', 'doo', 2)
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 250), 'doo')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 250), 'doo')
    })()
  ]))
  assert.strictEqual((eb as any).onceWaitersMap.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar', 2)
      await setTimeout(100)
      eb.abort('foo')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    assert.rejects(eb.waitFor('foo', 250), { name: 'AbortionError' }),
    assert.rejects(eb.waitFor('foo', 250), { name: 'AbortionError' })
  ]))
  assert.strictEqual((eb as any).onceWaitersMap.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar', 2)
    })(),
    assert.rejects(eb.waitFor('foo', 10), { name: 'TimeoutError' }),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo', 150), 'bar')
    })(),
    assert.rejects(eb.waitFor('foo', 200), { name: 'TimeoutError' }),
    assert.rejects(eb.waitFor('foo', 200), { name: 'TimeoutError' })
  ]))
  assert.strictEqual((eb as any).onceWaitersMap.size, 0)

  let ac = new AbortController
  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar', 2)
      ac.abort()
    })(),
    assert.rejects(eb.waitFor('foo', 50, ac.signal), { name: 'TimeoutError' }),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    assert.rejects(eb.waitFor('foo', undefined, ac.signal), { name: 'AbortedBySignalError' }),
    assert.rejects(eb.waitFor('foo', undefined, ac.signal), { name: 'AbortedBySignalError' }),
    assert.rejects(eb.waitFor('foo', 200, ac.signal), { name: 'AbortedBySignalError' }),
    assert.rejects(eb.waitFor('foo', 200), { name: 'TimeoutError' }),
  ]))
  assert.strictEqual((eb as any).onceWaitersMap.size, 0)

  const readIter = async (count: number, options: { timeout?: number, signal?: AbortSignal } = {}) => {
    let i = 0
    try {
      for await (const bar of eb.asIterator<string>('foo', options)) {
        assert.strictEqual(bar, `bar${i++}`)
      }
    } catch (err) {
      assert.strictEqual(i, count)
      throw err
    }
  }

  await assert.doesNotReject(Promise.all([
    (async () => {
      for (let i = 0; i < 10; i++) {
        await setTimeout(100)
        eb.notify('foo', `bar${i}`)
      }
      eb.abort('foo', new Error('EOF'))
    })(),
    assert.rejects(readIter(10), { message: 'EOF' })
  ]))
  assert.strictEqual((eb as any).onWaitersMap.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      assert.strictEqual((eb as any).onWaitersMap.get('foo').length, 1)
      for (let i = 0; i < 5; i++) {
        eb.notify('foo', `bar${i}`)
      }
      await setTimeout(100)
      assert.strictEqual((eb as any).onWaitersMap.get('foo').length, 1)
      for (let i = 5; i < 10; i++) {
        assert.strictEqual((eb as any).onWaitersMap.get('foo').length, 1)
        eb.notify('foo', `bar${i}`)
        assert.strictEqual((eb as any).onWaitersMap.get('foo').length, 1)
      }
      eb.abort('foo', new Error('EOF'))
    })(),
    assert.rejects(readIter(10), { message: 'EOF' })
  ]))
  assert.strictEqual((eb as any).onWaitersMap.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      assert.strictEqual((eb as any).onWaitersMap.get('foo').length, 1)
      for (let i = 0; i < 5; i++) {
        eb.notify('foo', `bar${i}`)
      }
      eb.abort('foo')
    })(),
    assert.rejects(readIter(5), { name: 'AbortionError' })
  ]))
  assert.strictEqual((eb as any).onWaitersMap.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(50)
      assert.strictEqual((eb as any).onWaitersMap.get('foo').length, 1)
      for (let i = 0; i < 5; i++) {
        await setTimeout(i * 100 + 100)
        eb.notify('foo', `bar${i}`)
      }
      assert.strictEqual((eb as any).onWaitersMap.size, 0)
    })(),
    assert.rejects(readIter(3, { timeout: 350 }), { name: 'TimeoutError' })
  ]))
  assert.strictEqual((eb as any).onWaitersMap.size, 0)

  ac = new AbortController
  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(50)
      assert.strictEqual((eb as any).onWaitersMap.get('foo').length, 1)
      for (let i = 0; i < 5; i++) {
        eb.notify('foo', `bar${i}`)
      }
      ac.abort()
      assert.strictEqual((eb as any).onWaitersMap.size, 0)
      for (let i = 5; i < 10; i++) {
        eb.notify('foo', `bar${i}`)
      }
      assert.strictEqual((eb as any).onWaitersMap.size, 0)
    })(),
    assert.rejects(readIter(5, { signal: ac.signal }), { name: 'AbortedBySignalError' })
  ]))
  assert.strictEqual((eb as any).onWaitersMap.size, 0)

  console.log('Tests passed')
}

test()
