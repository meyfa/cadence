type SerializeFn<TDocument> = (document: TDocument) => string
type ParseFn<TDocument> = (data: string) => TDocument | undefined

export interface Storage<TDocument> {
  readonly load: () => TDocument | undefined
  readonly save: (document: TDocument) => void
}

export class BrowserLocalStorage<TDocument> implements Storage<TDocument> {
  constructor (
    private readonly key: string,
    private readonly serialize: SerializeFn<TDocument>,
    private readonly parse: ParseFn<TDocument>
  ) {}

  load (): TDocument | undefined {
    const data = localStorage.getItem(this.key)
    if (data == null) {
      return undefined
    }

    return this.parse(data)
  }

  save (document: TDocument): void {
    const data = this.serialize(document)
    localStorage.setItem(this.key, data)
  }
}
