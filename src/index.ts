import { EventEmitter } from 'events'


export type ErrorType = Error | string | number

type TimeoutHandle = ReturnType<typeof setTimeout>

interface Waiter {
  resolve: (value: any) => void
  reject: (err: ErrorType) => void
  tHandle?: TimeoutHandle
  abortSignal?: { signal: AbortSignal, onAbort: (this: AbortSignal, ev: Event) => any }
}

type EventWaiter = Waiter[]

export class TimeoutError extends Error {
  public readonly name: string = 'TimeoutError'
  public readonly source: string = 'Sync.EventBarrier'
  public readonly event?: string
  constructor(msg?: string, event?: string) {
    super(msg)
    if (event) this.event = event
  }
}

export class AbortionError extends Error {
  public readonly name: string = 'AbortionError'
  public readonly source: string = 'Sync.EventBarrier'
  public readonly event?: string
  constructor(msg?: string, event?: string) {
    super(msg)
    if (event) this.event = event
  }
}

export class AbortedBySignalError extends AbortionError {
  public readonly name: string = 'AbortedBySignalError'
  public readonly source: string = 'Sync.EventBarrier'
  public readonly event?: string
  constructor(msg: string = 'Aborted by signal', event?: string) {
    super(msg, event)
    if (event) this.event = event
  }
}

/**
 * Event barrier
 * 
 * Note: do not reuse the instance to avoid event leak
 */
export class EventBarrier extends EventEmitter {
  private waiters: Map<
    /* event */ string,
    /* resolvers, timeout handles, etc. */ EventWaiter
  > = new Map
  /**
   * Internal emitter
   */
  private emitter = new EventEmitter

  /**
   * Notify all the waiters of the event
   * @param event Event that just happened
   * @param value Event payload value (as the second argument of
   * `EventEmitter.prototype.emit`)
   * @param count The number of waiters to be waked up. Leave `undefined` to
   * wake up all of them
   */
  public notify(event: string, value?: any, count?: number) {
    this.emit(event, value)
    this.emitter.emit(event, value, count)
    return this
  }

  /**
   * Abort waiters that are waiting for an event, causing `waitFor` to reject
   * @param event The event that the waiters are still waiting for
   * @param err Error as rejection reason
   */
  public abort(event: string, err?: ErrorType) {
    const { emitter, waiters } = this
    if (!err) err = new AbortionError(undefined, event)
    const eventWaiter = waiters.get(event)
    if (eventWaiter) {
      for (const waiter of eventWaiter) {
        EventBarrier.abortWaiter(waiter, err)
      }
      waiters.delete(event)
      emitter.removeAllListeners(event)
    }
    return this
  }

  /**
   * Abort all waiters on all events
   * @param err Error as rejection reason
   */
  public abortAll(err?: ErrorType) {
    this.waiters.forEach((_, key) => this.abort(key, err))
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
    return new Promise<any>((res, rej) => {
      const eventWaiter = this.getOrCreateEventWaiter(event)
      const { emitter } = this
      let thisWaiter: Waiter = { resolve: res, reject: rej }
      const onNotify = (value: any, count?: number) => {
        if (count == undefined) count = eventWaiter.length
        for (const waiter of eventWaiter.splice(0, count)) {
          EventBarrier.resolveWaiter(waiter, value)
        }
        // Clean up waiter
        if (eventWaiter.length == 0) {
          this.waiters.delete(event)
          emitter.removeAllListeners(event)
        }
      }
      if (emitter.listeners(event).length == 0) emitter.on(event, onNotify)
      const getOnAbort = (reason: TimeoutError | AbortedBySignalError) => {
        return () => {
          const waiterIndex = eventWaiter.indexOf(thisWaiter)
          if (waiterIndex >= 0) eventWaiter.splice(waiterIndex, 1)
          // Clean up waiter
          if (eventWaiter.length == 0) {
            this.waiters.delete(event)
            emitter.removeAllListeners(event)
          }
          EventBarrier.abortWaiter(thisWaiter, reason)
        }
      }
      if (signal) {
        const onAbortBySignal = getOnAbort(new AbortedBySignalError(undefined, event))
        signal.addEventListener('abort', onAbortBySignal)
        thisWaiter.abortSignal = { signal, onAbort: onAbortBySignal }
      }
      if (timeout != undefined) {
        const t: ReturnType<typeof setTimeout> = setTimeout(getOnAbort(new TimeoutError(undefined, event)), timeout)
        thisWaiter.tHandle = t
      }
      eventWaiter.push(thisWaiter)
    })
  }

  private getOrCreateEventWaiter(event: string) {
    const { waiters } = this
    const waiter = waiters.get(event)
    if (waiter) return waiter
    else {
      const newWaiter: EventWaiter = []
      waiters.set(event, newWaiter)
      return newWaiter
    }
  }

  private static resolveWaiter({ resolve, tHandle, abortSignal }: Waiter, value: any) {
    EventBarrier.cleanUp(tHandle, abortSignal)
    resolve(value)
  }

  private static abortWaiter({ reject, tHandle, abortSignal }: Waiter, reason: ErrorType) {
    EventBarrier.cleanUp(tHandle, abortSignal)
    reject(reason)
  }

  private static cleanUp(tHandle?: TimeoutHandle, abortSignal?: { signal: AbortSignal, onAbort: (this: AbortSignal, ev: Event) => any }) {
    if (tHandle) clearTimeout(tHandle)
    if (abortSignal) abortSignal.signal.removeEventListener('abort', abortSignal.onAbort)
  }
}

export default EventBarrier
