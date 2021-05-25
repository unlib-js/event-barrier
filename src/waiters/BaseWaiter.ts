import { AbortedBySignalError, ErrorType, TimeoutError } from '../errors'


export type TimeoutHandle = ReturnType<typeof setTimeout>
export type AbortInfo = { signal: AbortSignal, onAbort: (this: AbortSignal, ev: Event) => any }

export interface TimeoutConfig {
  timeout: number
  err: TimeoutError
}

export interface AbortSignalConfig {
  signal: AbortSignal
  err: AbortedBySignalError
}

// Avoid cyclic dependency
export interface WaiterRegistry<T> {
  remove(waiter: BaseWaiter<T>): this
}

/**
 * Base waiter class
 */
export abstract class BaseWaiter<T> {
  public event: string
  protected reg: WaiterRegistry<T>
  protected timeoutConf?: TimeoutConfig
  protected tHandle?: TimeoutHandle
  protected abortInfo?: AbortInfo

  /**
   * 
   * @param event the event for which this waiter is waiting
   * @param eb the event barrier that holds this waiter
   * @param timeoutConf timeout config
   * @param abortSignalConf abort signal config (it is caller's responsibility to check if the signal is already aborted)
   */
  constructor(event: string, eb: WaiterRegistry<T>, timeoutConf?: TimeoutConfig, abortSignalConf?: AbortSignalConfig) {
    this.event = event
    this.reg = eb
    if (timeoutConf) {
      this.timeoutConf = timeoutConf
      this.setTimeout()
    }
    if (abortSignalConf) {
      const { signal, err } = abortSignalConf
      const onAbort = () => this.abort(err).dispose()
      signal.addEventListener('abort', onAbort)
      this.abortInfo = { signal, onAbort }
    }
  }

  /**
   * The event barrier calls this method to notify the waiter of new value of a specific event
   * @param value value to pass to the waiter
   */
  public abstract onNext(value: T): this

  /**
   * The event barrier calls this method to abort the waiter
   * 
   * The waiter itself may also call this method on timeout, external abortion or other child-class defined events
   * 
   * Implementation of `abort` must also call `dispose`
   * 
   * @param err cause of the abortion
   */
  public abstract abort(err: ErrorType): this

  /**
   * Dispose this waiter, called by the waiter itself (end of waiting, timeout, external abortion, etc.)
   */
  protected dispose() {
    const { tHandle, abortInfo } = this
    if (tHandle) {
      clearTimeout(tHandle)
      delete this.tHandle
    }
    if (abortInfo) {
      abortInfo.signal.removeEventListener('abort', abortInfo.onAbort)
      delete this.abortInfo
    }
    // Remove this waiter from the registry
    this.reg.remove(this)
  }

  /**
   * Set or reset timeout timer
   */
  protected setTimeout() {
    const { tHandle, timeoutConf } = this
    const { timeout, err } = timeoutConf!
    if (tHandle) clearTimeout(tHandle)
    this.tHandle = setTimeout(() => this.abort(err).dispose(), timeout)
  }
}

export default BaseWaiter
