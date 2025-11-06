type SerializeFn<TDocument> = (document: TDocument) => string
type ParseFn<TDocument> = (data: string) => TDocument | undefined

type StorageEventCallback = () => void
type UnsubscribeFn = () => void

export interface Storage<TSave, TLoad = TSave> {
  readonly save: (document: TSave) => void
  readonly load: () => TLoad | undefined
  readonly onExternalChange?: (callback: StorageEventCallback) => UnsubscribeFn
}

export class BrowserLocalStorage<TSave, TLoad = TSave> implements Storage<TSave, TLoad> {
  constructor (
    private readonly key: string,
    private readonly serialize: SerializeFn<TSave>,
    private readonly parse: ParseFn<TLoad>
  ) {}

  save (document: TSave): void {
    const data = this.serialize(document)
    localStorage.setItem(this.key, data)
  }

  load (): TLoad | undefined {
    const data = localStorage.getItem(this.key)
    if (data == null) {
      return undefined
    }

    return this.parse(data)
  }

  onExternalChange (callback: StorageEventCallback): UnsubscribeFn {
    const handler = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && event.key === this.key && event.newValue !== event.oldValue) {
        callback()
      }
    }

    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  }
}
