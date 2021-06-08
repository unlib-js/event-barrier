# `EventBarrier`

`async-await`-style synchronization primitive in JavaScript world.

This is like the `once` helper function in the built-in module `events` of Node.js but with more powerful utilities.
It is useful to wrap a legacy event-style object to avoid scattered local states.

## Example

```TypeScript
import EventBarrier from 'event-barrier'

const eb = new EventBarrier

async function foo() {
  sendRequest('blah')
  await eb.waitFor('response', 5000)
}

// Somewhere else
eb.notify('response', res)
```

```TypeScript
import EventBarrier from 'event-barrier'

const eb = new EventBarrier

async function foo() {
  try {
    for await (const response of eb.asIterator<Response>('response', { timeout: 5000 })) {
      // Handle response
    }
  } catch (err) {
    // Asynchronous iteration is aborted
  }
}

// Somewhere else
async function handleRequest(requests: Request[]) {
  // ...
  for (const req of requests.splice(0, 5)) {
    // ...
    eb.notify('response', res)  // Emitted in the same tick
  }
  for (const req of requests) {
    // ...
    await someExternalQuery()
    eb.notify('response', res)  // Emitted in different tick
  }
  // ...
}
```

## Important Note

Do not use `waitFor` like this:

```TypeScript
async function foo() {
  try {
    while (true) {
      console.log(await eb.waitFor('foo'))
    }
  } catch (err) {
    if (!(err instanceof AbortionError)) throw err
  }
}

async function bar() {
  eb.notify('foo', 1)
  eb.notify('foo', 2)
  await nextTick()
  eb.notify('foo', 3)
  eb.notify('foo', 4)
  eb.abort('foo')
}

foo()
bar()
```

The output will be:

    1
    3

Note that the final `waitFor` call in `foo` will not be aborted even if `bar` has called `abort`. The reason why `2` and `4` were missed and `foo` was not aborted is that these events were emitted before the `while` loop calls `waitFor` again. More specifically, if you call `notify` (without specifying a `count` parameter) multiple times in the same tick, the followings would happen in this tick:

1. All pending `waitFor` calls will be resolved by the first `notify` call.
2. No new `waitFor` calls will have a chance to cut in the synchronous sequence of `notify` calls to get into the queue until next tick.

Hence the ordering of calls/events in the above example is:

1. *First tick*
2. First `eb.waitFor('foo')` pending
3. `eb.notify('foo', 1)`
4. First `eb.waitFor('foo')` resolved
5. `eb.notify('foo', 2)`
6. `nextTick`
7. *Second tick*
8. Second `eb.waitFor('foo')` pending
9. `eb.notify('foo', 3)`
10. Second `eb.waitFor('foo')` resolved
11. `eb.notify('foo', 4)`
12. `eb.abort('foo')`
13. *Third tick*
14. Third `eb.waitFor('foo')` pending

To read event stream in a `async-await` fashion, use `eb.asIterator`, which has an internal queue, as shown in the [example](#example).

## Polyfill for `events` Module

`EventBarrier` inherits from `events.EventEmitter` class, which is a built-in class of Node.js. Therefore, if you want to use `EventBarrier` in the browser, you need to provide polyfill for `events` module. For `webpack` bundler, the polyfill is already included. For `rollup` bundler, please remember to install the `events` package:

```bash
npm install events --save
```

If you are using TypeScript, you may also install typings for the `events` package:

```bash
npm install @types/events --save-dev
```
