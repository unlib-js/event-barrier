import { EventEmitter } from 'events'
import { AbortedBySignalError, AbortionError, ErrorType, TimeoutError } from './errors'
import { EventWaiter, BaseWaiter, WaiterRegistry, Waiter, OnceWaiter, TimeoutConfig, AbortSignalConfig, OnWaiter } from './waiters'


/**
 * Event barrier
 * 
 * Note: do not reuse the instance to avoid event leak
 */
export class EventBarrier extends EventEmitter implements WaiterRegistry<any> {
  private onceWaitersMap: Map<
    /* event */ string,
    /* resolvers, timeout handles, etc. */ OnceWaiter<any>[]
  > = new Map
  private onWaitersMap: Map<
    /* event */ string,
    /* resolvers, timeout handles, etc. */ OnWaiter<any>[]
  > = new Map

  /**
   * Notify all the waiters of the event
   * @param event Event that just happened
   * @param value Event payload value (as the second argument of
   * `EventEmitter.prototype.emit`)
   * @param count The number of waiters to be waked up. Leave `undefined` to
   * wake up all of them. All asynchronous iterators, however, will be waked up
   */
  public notify(event: string, value?: any, count?: number) {
    this.emit(event, value)
    const once = this.getOrCreateOnceWaiters(event)
    if (count === undefined) count = once.length
    // Notify once-waiters
    for (const waiter of once.slice(0, count)) waiter.onNext(value)
    const on = this.getOrCreateOnWaiters(event)
    // Notify on-waiters
    for (const waiter of on.slice()  /* In case it would change */) waiter.onNext(value)
    // Just in case
    const { onceWaitersMap, onWaitersMap } = this
    if (onceWaitersMap.get(event)?.length == 0) onceWaitersMap.delete(event)
    if (onWaitersMap.get(event)?.length == 0) onWaitersMap.delete(event)
    return this
  }

  /**
   * Abort waiters that are waiting for an event, causing `waitFor` and
   * `asIterator` to reject
   * @param event The event that the waiters are still waiting for
   * @param err Error as rejection reason
   */
  public abort(event: string, err?: ErrorType) {
    const { onceWaitersMap, onWaitersMap } = this
    if (!err) err = new AbortionError(undefined, event)
    const once = onceWaitersMap.get(event)
    if (once) {
      for (const waiter of once.slice(0)) waiter.abort(err)
      onceWaitersMap.delete(event)
    }
    const on = onWaitersMap.get(event)
    if (on) {
      for (const waiter of on.slice(0)) waiter.abort(err)
      onWaitersMap.delete(event)
    }
    return this
  }

  /**
   * Abort all waiters on all events
   * @param err Error as rejection reason
   */
  public abortAll(err?: ErrorType) {
    const { onceWaitersMap, onWaitersMap } = this
    for (const key of onceWaitersMap.keys()) this.abort(key, err)
    for (const key of onWaitersMap.keys()) this.abort(key, err)
    return this
  }

  /**
   * Wait for specific event to happen
   * @param event Event to wait for
   * @param timeout If specified, a `TimeoutError` will be thrown after that
   * amount of time (in milliseconds)
   * @param signal If specified, an `AbortError` will be thrown if aborted
   */
  public waitFor<T>(event: string, timeout?: number, signal?: AbortSignal): Promise<T> {
    const onceWaiters = this.getOrCreateOnceWaiters(event)
    const timeoutConf: TimeoutConfig | undefined = timeout === undefined ?
      undefined :
      { timeout, err: new TimeoutError(undefined, event) }
    const abortSignalConf: AbortSignalConfig | undefined = signal ?
      { signal, err: new AbortedBySignalError(undefined, event) } :
      undefined
    const waiter = new OnceWaiter<T>(event, this, timeoutConf, abortSignalConf)
    onceWaiters.push(waiter)
    return waiter.prom
  }

  public asIterator<T>(event: string, { timeout, signal }: { timeout?: number, signal?: AbortSignal } = {}): AsyncGenerator<T, void, void> {
    const onWaiters = this.getOrCreateOnWaiters(event)
    const timeoutConf: TimeoutConfig | undefined = timeout === undefined ?
      undefined :
      { timeout, err: new TimeoutError(undefined, event) }
    const abortSignalConf: AbortSignalConfig | undefined = signal ?
      { signal, err: new AbortedBySignalError(undefined, event) } :
      undefined
    const waiter = new OnWaiter<T>(event, this, timeoutConf, abortSignalConf)
    onWaiters.push(waiter)
    return waiter
  }

  private getOrCreateOnceWaiters(event: string) {
    const { onceWaitersMap } = this
    let waiters = onceWaitersMap.get(event)
    if (!waiters) {
      waiters = []
      onceWaitersMap.set(event, waiters)
    }
    return waiters
  }

  private getOrCreateOnWaiters(event: string) {
    const { onWaitersMap } = this
    let waiters = onWaitersMap.get(event)
    if (!waiters) {
      waiters = []
      onWaitersMap.set(event, waiters)
    }
    return waiters
  }

  /**
   * Internal interface for the waiter to remove itself
   */
  public remove(waiter: BaseWaiter<any>) {
    const { event } = waiter
    const { onceWaitersMap, onWaitersMap } = this
    let eventWaiter: EventWaiter | undefined
    let map: Map<string, EventWaiter>
    if (waiter instanceof OnceWaiter) {
      eventWaiter = onceWaitersMap.get(event)
      map = onceWaitersMap
    } else if (waiter instanceof OnWaiter) {
      eventWaiter = onWaitersMap.get(event)
      map = onWaitersMap
    }
    if (eventWaiter) {
      const i = eventWaiter.indexOf(waiter as Waiter)
      if (i >= 0) {
        eventWaiter.splice(i, 1)
        if (eventWaiter.length == 0) {
          map!.delete(event)
        }
      }
    }
    return this
  }
}

export default EventBarrier
