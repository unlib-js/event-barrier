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
