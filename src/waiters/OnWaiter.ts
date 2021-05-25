import { ErrorType } from '../errors'
import BaseWaiter from './BaseWaiter'


/**
 * Waiter that waits multiple times
 * 
 * OnWaiter is aborted by external abort signal, timeout, or `EventBarrier.abort()`
 */
export class OnWaiter<T> extends BaseWaiter<T> implements AsyncGenerator<any, void, void> {
  /* Request comes before response */

  /**
   * Exactly one pending request (in which case future response should settle it right here instead of enqueueing)
   */
  public prom?: { res: (val: IteratorResult<any, void>) => void, rej: (err: ErrorType) => void }

  /* Response(s) come before request(s) */

  /**
   * Queued responses (in which case the requests can be settled immediately)
   */
  public queue: T[] = []
  /**
   * Queued error
   */
  public hasError = false
  public err: ErrorType | undefined

  public onNext(value: T) {
    // Discard values after error (note this is different from `events.on`,
    // which allows values after an error event to cut in the queue)
    if (this.hasError) return this
    const { prom } = this
    if (prom) {
      // Pending request
      prom.res({ value })
      delete this.prom
    } else {
      this.queue.push(value)
    }
    return this
  }

  public abort(err: ErrorType) {
    const { prom } = this
    if (prom) {
      prom.rej(err)
      delete this.prom
    } else {
      this.hasError = true
      this.err = err
    }
    this.dispose()
    return this
  }

  public async next(..._: []): Promise<IteratorResult<any, void>> {
    if (this.timeoutConf) this.setTimeout()  // Reset timeout timer
    const { queue } = this
    // Consume the queue first
    if (queue.length) return { value: queue.shift() }
    // And then the error
    if (this.hasError) throw this.err
    // Nothing to consume, have to wait
    if (this.prom) throw new Error('Concurrent calls to next()')
    return new Promise((res, rej) => {
      this.prom = { res, rej }
    })
  }
  
  public async return(value: void | PromiseLike<void>): Promise<IteratorResult<any, void>> {
    await value
    this.dispose()
    return { value: undefined, done: true }
  }

  public async throw(err: ErrorType): Promise<IteratorResult<any, void>> {
    this.abort(err)
    return { value: undefined, done: true }
  }

  public [Symbol.asyncIterator](): AsyncGenerator<any, void, void> {
    return this
  }
}

export default OnWaiter
