export type Dispose = () => void

export interface Disposable {
  readonly dispose: Dispose
}

export class DisposeStack implements Disposable {
  private items: Dispose[] = []

  push (dispose: Dispose): void {
    this.items.push(dispose)
  }

  pushDisposable (disposable: Disposable): void {
    this.items.push(disposable.dispose.bind(disposable))
  }

  dispose (): void {
    while (this.items.length > 0) {
      this.items.pop()?.()
    }
  }
}
