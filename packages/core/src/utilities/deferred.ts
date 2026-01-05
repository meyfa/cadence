export interface Deferred<T> {
  readonly promise: Promise<T>

  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: unknown) => void
}

export function createDeferred<T = void> (): Deferred<T> {
  let resolve: Deferred<T>['resolve']
  let reject: Deferred<T>['reject']

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers#description
  // eslint-disable-next-line promise/param-names
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return { promise, resolve: resolve!, reject: reject! }
}
