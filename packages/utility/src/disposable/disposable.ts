export type Dispose = () => void

export interface Disposable {
  readonly dispose: Dispose
}

export class DisposeStack implements Disposable {
  private items: Dispose[] = []
  private disposed = false

  push (dispose: Dispose): void {
    if (this.disposed) {
      dispose()
      return
    }

    this.items.push(dispose)
  }

  pushDisposable (disposable: Disposable): void {
    this.push(disposable.dispose.bind(disposable))
  }

  dispose (): void {
    if (this.disposed) {
      return
    }

    this.disposed = true

    while (this.items.length > 0) {
      this.items.pop()?.()
    }
  }
}
