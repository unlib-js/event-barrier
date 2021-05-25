import { ErrorType } from '../errors'
import BaseWaiter, { TimeoutConfig, AbortSignalConfig, WaiterRegistry } from './BaseWaiter'


/**
 * Waiter that waits only once
 * 
 * OnceWaiter is aborted by external abort signal or timeout
 */
export class OnceWaiter<T> extends BaseWaiter<T> {
  public prom: Promise<T>
  public resolve!: (value: T) => void
  public reject!: (err: ErrorType) => void

  constructor(event: string, eb: WaiterRegistry<T>, timeoutConf?: TimeoutConfig, abortSignalConf?: AbortSignalConfig) {
    super(event, eb, timeoutConf, abortSignalConf)
    this.prom = new Promise<T>((res, rej) => {
      this.resolve = res
      this.reject = rej
    })
  }

  public onNext(value: T) {
    this.resolve(value)
    this.dispose()
    return this
  }

  public abort(err: ErrorType) {
    this.reject(err)
    this.dispose()
    return this
  }
}

export default OnceWaiter
