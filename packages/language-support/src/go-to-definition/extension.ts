import { syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorSelection, StateEffect, StateField } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { applySemanticOperation } from '../utilities/operations.ts'
import type { SourceRange } from '../utilities/range.ts'
import { sameRange } from '../utilities/range.ts'
import type { GoToDefinitionResult } from './operation.ts'
import { goToDefinition } from './operation.ts'

interface Coordinates {
  readonly x: number
  readonly y: number
}

function isApplePlatform (): boolean {
  const userAgent = navigator.userAgent.toLowerCase()

  return [
    'iphone',
    'ipad',
    'ipod',
    'macintosh',
    'mac os'
  ].some((platform) => userAgent.includes(platform))
}

const APPLE_PLATFORM = isApplePlatform()

function isPrimaryModifierPressed (event: MouseEvent | KeyboardEvent): boolean {
  return APPLE_PLATFORM ? event.metaKey : event.ctrlKey
}

function isPrimaryModifierKey (key: string): boolean {
  return APPLE_PLATFORM ? key === 'Meta' : key === 'Control'
}

function findDefinitionAtCoordinates (view: EditorView, coords: Coordinates): GoToDefinitionResult | undefined {
  const position = getPositionAtCoordinates(view, coords)
  if (position == null) {
    return undefined
  }

  const tree = syntaxTree(view.state)

  const result = applySemanticOperation(goToDefinition, tree, view.state.doc, position)
  if (result == null) {
    return undefined
  }

  // Don't treat trailing whitespace (right of token) as hovering the token.
  return rangeContainsXCoordinate(view, result.identifier.range, coords) ? result : undefined
}

function getPositionAtCoordinates (view: EditorView, coords: Coordinates): number | undefined {
  const pos = view.posAndSideAtCoords(coords)
  if (pos == null) {
    return undefined
  }

  return pos.assoc < 0 ? pos.pos - 1 : pos.pos
}

function rangeContainsXCoordinate (view: EditorView, range: SourceRange, coords: Coordinates): boolean {
  const start = view.coordsAtPos(range.offset)
  const end = view.coordsAtPos(range.offset + range.length)
  if (start == null || end == null) {
    return false
  }

  const minX = Math.min(start.left, start.right, end.left, end.right)
  const maxX = Math.max(start.left, start.right, end.left, end.right)

  // Small tolerance to avoid flicker on exact boundaries.
  const tolerance = 1
  return coords.x >= minX - tolerance && coords.x <= maxX + tolerance
}

const HOVER_CLASS = 'cm-cadence-go-to-definition-hover'

const hoverMark = Decoration.mark({ class: HOVER_CLASS })

const theme = EditorView.baseTheme({
  [`.${HOVER_CLASS}`]: {
    textDecoration: 'underline',
    cursor: 'pointer'
  }
})

const setHover = StateEffect.define<SourceRange | undefined>()

const hoverDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,

  update: (value, transaction) => {
    let next = value

    if (transaction.docChanged) {
      next = next.map(transaction.changes)
    }

    for (const effect of transaction.effects) {
      if (!effect.is(setHover)) {
        continue
      }

      next = effect.value == null
        ? Decoration.none
        : Decoration.set([hoverMark.range(effect.value.offset, effect.value.offset + effect.value.length)])
    }

    return next
  },

  provide: (field) => EditorView.decorations.from(field)
})

interface MeasureRequest<T> {
  readonly read: (view: EditorView) => T
  readonly write?: (measure: T, view: EditorView) => void
  readonly key?: unknown
}

class GoToDefinitionInteractionsPlugin {
  private readonly view: EditorView

  private readonly hoverMeasureRequest: MeasureRequest<SourceRange | undefined>

  private lastMousePosition: Coordinates | undefined
  private modifierHeld = false
  private lastDispatchedRange: SourceRange | undefined
  private pendingHoverDispatchRange: SourceRange | undefined
  private hoverDispatchScheduled = false

  constructor (view: EditorView) {
    this.view = view

    this.hoverMeasureRequest = {
      key: this,

      read: (view: EditorView): SourceRange | undefined => {
        return this.modifierHeld && this.lastMousePosition != null
          ? findDefinitionAtCoordinates(view, this.lastMousePosition)?.identifier.range
          : undefined
      },

      write: (measure: SourceRange | undefined) => {
        this.scheduleHoverDispatch(measure)
      }
    }
  }

  update (update: ViewUpdate): void {
    if (!update.docChanged) {
      return
    }

    if (this.modifierHeld && this.lastMousePosition != null) {
      this.view.requestMeasure(this.hoverMeasureRequest)
      return
    }

    this.scheduleHoverDispatch(undefined)
  }

  onMouseMove (event: MouseEvent): void {
    this.lastMousePosition = { x: event.clientX, y: event.clientY }
    this.modifierHeld = isPrimaryModifierPressed(event)
    this.refreshHover()
  }

  onMouseLeave (): void {
    this.lastMousePosition = undefined
    this.modifierHeld = false
    this.scheduleHoverDispatch(undefined)
  }

  onKeyDown (event: KeyboardEvent): void {
    if (isPrimaryModifierKey(event.key)) {
      this.modifierHeld = true
      this.refreshHover()
    }
  }

  onKeyUp (event: KeyboardEvent): void {
    if (isPrimaryModifierKey(event.key)) {
      this.modifierHeld = false
      this.scheduleHoverDispatch(undefined)
    }
  }

  onMouseDown (event: MouseEvent): void {
    if (event.button !== 0 || !isPrimaryModifierPressed(event)) {
      return
    }

    const mousePosition = { x: event.clientX, y: event.clientY }

    const range = findDefinitionAtCoordinates(this.view, mousePosition)?.binding.range
    if (range == null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const selection = EditorSelection.single(range.offset)
    this.view.dispatch({ selection, scrollIntoView: true })
    this.view.focus()
  }

  private refreshHover (): void {
    const identifier = this.modifierHeld && this.lastMousePosition != null
      ? findDefinitionAtCoordinates(this.view, this.lastMousePosition)?.identifier
      : undefined

    this.scheduleHoverDispatch(identifier?.range)
  }

  private scheduleHoverDispatch (range: SourceRange | undefined): void {
    this.pendingHoverDispatchRange = range
    if (this.hoverDispatchScheduled) {
      return
    }

    this.hoverDispatchScheduled = true

    // In some CodeMirror update paths (notably measure flush), dispatching immediately
    // can be re-entrant and throw "Calls to EditorView.update are not allowed while an update is in progress".
    // Deferring ensures we dispatch after the current update/measure cycle completes.
    queueMicrotask(() => {
      this.hoverDispatchScheduled = false

      const next = this.pendingHoverDispatchRange
      this.pendingHoverDispatchRange = undefined

      if (this.view.dom.isConnected) {
        this.dispatchHover(next)
      }
    })
  }

  private dispatchHover (range: SourceRange | undefined): void {
    if (
      (this.lastDispatchedRange == null && range != null) ||
      (this.lastDispatchedRange != null && range == null) ||
      (this.lastDispatchedRange != null && range != null && !sameRange(this.lastDispatchedRange, range))
    ) {
      this.view.dispatch({ effects: setHover.of(range) })
    }

    this.lastDispatchedRange = range
  }
}

const plugin = ViewPlugin.fromClass(GoToDefinitionInteractionsPlugin, {
  eventHandlers: {
    mousemove: (event, view) => {
      view.plugin(plugin)?.onMouseMove(event)
    },
    mouseleave: (_event, view) => {
      view.plugin(plugin)?.onMouseLeave()
    },
    keydown: (event, view) => {
      view.plugin(plugin)?.onKeyDown(event)
      return false
    },
    keyup: (event, view) => {
      view.plugin(plugin)?.onKeyUp(event)
      return false
    },
    mousedown: (event, view) => {
      view.plugin(plugin)?.onMouseDown(event)
    }
  }
})

export function goToDefinitionExtension (): Extension {
  return [theme, hoverDecorations, plugin]
}
