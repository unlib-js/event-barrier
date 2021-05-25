import OnceWaiter from './OnceWaiter'
import OnWaiter from './OnWaiter'

export type Waiter = OnceWaiter<any> | OnWaiter<any>
export type EventWaiter = Waiter[]

export * from './BaseWaiter'
export * from './OnceWaiter'
export * from './OnWaiter'
