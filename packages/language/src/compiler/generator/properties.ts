import { RecordFacet } from '../../type-system/base/record.ts'
import type { Facet, FacetType, Value } from '../../type-system/types.ts'
import { assert } from '../assert.ts'

export class RecordBuilder {
  private readonly types: Record<string, FacetType> = Object.create(null)
  private readonly values: Record<string, Value> = Object.create(null)

  public put (name: string, value: Value): void {
    assert(!Object.hasOwn(this.types, name))
    this.types[name] = value.type
    this.values[name] = value
  }

  public putAll (properties: Iterable<readonly [string, Value]>): void {
    for (const [name, value] of properties) {
      this.put(name, value)
    }
  }

  get empty (): boolean {
    return Object.keys(this.types).length === 0
  }

  get facet (): Facet {
    return RecordFacet.with(this.types)
  }

  get record (): Readonly<Record<string, Value>> {
    return this.values
  }
}
