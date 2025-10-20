type SerializeFn<TDocument> = (document: TDocument) => string
type ParseFn<TDocument> = (data: string) => TDocument | undefined

export interface Storage<TSave, TLoad = TSave> {
  readonly save: (document: TSave) => void
  readonly load: () => TLoad | undefined
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
}
