export type ErrorType = Error | string | number

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
  public readonly event?: string = undefined
  constructor(msg: string = 'Aborted by signal', event?: string) {
    super(msg, event)
    if (event) this.event = event
  }
}
