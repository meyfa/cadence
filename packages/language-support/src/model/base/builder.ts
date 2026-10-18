import type { SourceRange } from '../../utilities/range.ts'
import type { Import, Scope, Identifier, Binding, ScopeId, BaseModel } from '../model.ts'
import { importKey, scopeKey, identifierKey, bindingKey, conditionalBindingKey } from './keys.ts'

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

  get imports (): readonly Import[] {
    return this.#imports
  }

  get scopes (): readonly Scope[] {
    return this.#scopes
  }

  get identifiers (): readonly Identifier[] {
    return this.#identifiers
  }

  get bindings (): readonly Binding[] {
    return this.#bindings
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
    const statement = { ...input, id: importKey(input.moduleName, input.range) }
    this.#imports.push(statement)
    return statement
  }

  addScope (input: Omit<Scope, 'id'>): Scope {
    const entry = { ...input, id: scopeKey(input.node, input.range) }
    this.#scopes.push(entry)
    return entry
  }

  addIdentifier (input: Omit<Identifier, 'id'>): Identifier {
    const entry = { ...input, id: identifierKey(input.kind, input.scopeId, input.range) }
    this.#identifiers.push(entry)
    return entry
  }

  addBinding (input: Omit<Binding, 'id'>): Binding {
    const entry = { ...input, id: bindingKey(input.kind, input.scopeId, input.range) }
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
  addConditionalBinding (parentScopeId: string, branchScopeIds: readonly string[], endOffset: number): void {
    for (const [name, group] of this.collectBindingsByName(branchScopeIds)) {
      const firstDefinition = group.reduce((earliest, binding) => {
        return binding.range.offset < earliest.range.offset ? binding : earliest
      })

      this.#bindings.push({
        id: conditionalBindingKey(parentScopeId, endOffset, name),
        kind: 'regular',
        scopeId: parentScopeId,
        name,
        range: firstDefinition.range,
        visibilityStartOffset: endOffset,
        mergedFrom: group.map((binding) => binding.id)
      })
    }
  }

  private collectBindingsByName (scopeIds: readonly string[]): ReadonlyMap<string, Binding[]> {
    const groups = new Map<string, Binding[]>()

    for (const binding of this.#bindings) {
      if (binding.kind !== 'regular' || !scopeIds.includes(binding.scopeId)) {
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
