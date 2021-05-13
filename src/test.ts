import EventBarrier from '.'
import assert from 'assert'
import { setTimeout } from 'timers/promises'


async function test() {
  const eb = new EventBarrier
  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })()
  ]))
  assert.strictEqual((eb as any).waiters.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar', 2)
      assert.strictEqual((eb as any).waiters.get('foo').length, 2)
      await setTimeout(100)
      eb.notify('foo', 'doo', 2)
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'doo')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'doo')
    })()
  ]))
  assert.strictEqual((eb as any).waiters.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar', 2)
      await setTimeout(100)
      eb.abort('foo')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    assert.rejects(eb.waitFor('foo'), { name: 'AbortionError' }),
    assert.rejects(eb.waitFor('foo'), { name: 'AbortionError' })
  ]))
  assert.strictEqual((eb as any).waiters.size, 0)

  await assert.doesNotReject(Promise.all([
    (async () => {
      await setTimeout(100)
      eb.notify('foo', 'bar', 2)
    })(),
    assert.rejects(eb.waitFor('foo', 10), { name: 'TimeoutError' }),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    (async () => {
      assert.strictEqual(await eb.waitFor('foo'), 'bar')
    })(),
    assert.rejects(eb.waitFor('foo', 200), { name: 'TimeoutError' }),
    assert.rejects(eb.waitFor('foo', 200), { name: 'TimeoutError' })
  ]))
  assert.strictEqual((eb as any).waiters.size, 0)

  const ac = new AbortController
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
  assert.strictEqual((eb as any).waiters.size, 0)

  console.log('Tests passed')
}

test()
