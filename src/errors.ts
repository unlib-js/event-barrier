export type ErrorType = Error | string | number

export class TimeoutError extends Error {
  public override readonly name: string = 'TimeoutError'
  public readonly source: string = 'Sync.EventBarrier'
  public readonly event?: string
  constructor(msg?: string, event?: string) {
    super(msg)
    if (event) this.event = event
  }
}

export class AbortionError extends Error {
  public override readonly name: string = 'AbortionError'
  public readonly source: string = 'Sync.EventBarrier'
  public readonly event?: string
  constructor(msg?: string, event?: string, cause?: unknown) {
    super(msg, { cause })
    if (event) this.event = event
  }
}

export class AbortedBySignalError extends AbortionError {
  public override readonly name: string = 'AbortedBySignalError'
  public override readonly source: string = 'Sync.EventBarrier'
  public override readonly event?: string = undefined
  constructor(msg: string = 'Aborted by signal', event?: string, cause?: unknown) {
    super(msg, event, cause)
    if (event) this.event = event
  }
}
