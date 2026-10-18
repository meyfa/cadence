import type { SourceRange } from '../../utilities/range.ts'
import type { BaseModel, Binding, BindingId, Identifier, IdentifierId, Import, ImportId, Scope, ScopeId } from '../model.ts'

export class BaseModelBuilder {
  #imports: Import[] = []
  #scopes: Scope[] = []
  #identifiers: Identifier[] = []
  #bindings: Binding[] = []

  #rootScopeId: ScopeId

  constructor (rootScope: Omit<Scope, 'id'>) {
    const { id: rootScopeId } = this.addScope(rootScope)
    this.#rootScopeId = rootScopeId
  }

  get rootScopeId (): ScopeId {
    return this.#rootScopeId
  }

  build (): BaseModel {
    sortByOffset(this.#imports)
    sortByOffset(this.#scopes)
    sortByOffset(this.#identifiers)
    sortByOffset(this.#bindings)

    return {
      imports: this.#imports,
      scopes: this.#scopes,
      identifiers: this.#identifiers,
      bindings: this.#bindings,
      rootScopeId: this.#rootScopeId
    }
  }

  addImport (input: Omit<Import, 'id'>): Import {
    const id = `${input.moduleName}:${input.range.offset}:${input.range.length}` as ImportId
    const statement = { ...input, id }
    this.#imports.push(statement)
    return statement
  }

  addScope (input: Omit<Scope, 'id'>): Scope {
    const id = `${input.node}:${input.range.offset}:${input.range.length}` as ScopeId
    const entry = { ...input, id }
    this.#scopes.push(entry)
    return entry
  }

  addIdentifier (input: Omit<Identifier, 'id'>): Identifier {
    const id = `${input.kind}:${input.scopeId}:${input.range.offset}:${input.range.length}` as IdentifierId
    const entry = { ...input, id }
    this.#identifiers.push(entry)
    return entry
  }

  addBinding (input: Omit<Binding, 'id'>): Binding {
    const id = `${input.kind}:${input.scopeId}:${input.range.offset}:${input.range.length}` as BindingId
    const entry = { ...input, id }
    this.#bindings.push(entry)

    this.addIdentifier({
      kind: 'definition',
      scopeId: input.scopeId,
      name: input.name,
      range: input.range
    })

    return entry
  }

  /**
   * A variable assigned in every reachable branch of a conditional is visible afterward,
   * even though each assignment's own binding remains scoped to its own branch.
   */
  addConditionalBinding (parentScopeId: string, branchScopeIds: ReadonlySet<string>, endOffset: number): void {
    for (const [name, group] of this.collectBindingsByName(branchScopeIds)) {
      const firstDefinition = group.reduce((earliest, binding) => {
        return binding.range.offset < earliest.range.offset ? binding : earliest
      })

      this.#bindings.push({
        id: `merge:${parentScopeId}:${endOffset}:${name}` as BindingId,
        kind: 'regular',
        scopeId: parentScopeId,
        name,
        range: firstDefinition.range,
        visibilityStartOffset: endOffset,
        mergedFrom: group.map((binding) => binding.id)
      })
    }
  }

  private collectBindingsByName (scopeIds: ReadonlySet<string>): ReadonlyMap<string, Binding[]> {
    const groups = new Map<string, Binding[]>()

    for (const binding of this.#bindings) {
      if (binding.kind !== 'regular' || !scopeIds.has(binding.scopeId)) {
        continue
      }

      const group = groups.get(binding.name)
      if (group == null) {
        groups.set(binding.name, [binding])
        continue
      }

      group.push(binding)
    }

    return groups
  }
}

interface Rangeable {
  readonly range: SourceRange
}

function sortByOffset (items: Rangeable[]): void {
  items.sort((a, b) => a.range.offset - b.range.offset)
}
