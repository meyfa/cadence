import { syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorSelection, StateEffect, StateField } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { findIdentifierRangeAt, sameRange } from '../analysis/query.js'
import { applySemanticOperation } from '../operations.js'
import type { SourceRange } from '../types.js'
import { goToDefinition } from './operation.js'

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

function rangeContainsMouseX (view: EditorView, range: SourceRange, mouse: MousePosition): boolean {
  const start = view.coordsAtPos(range.offset)
  const end = view.coordsAtPos(range.offset + range.length)
  if (start == null || end == null) {
    return false
  }

  const minX = Math.min(start.left, start.right, end.left, end.right)
  const maxX = Math.max(start.left, start.right, end.left, end.right)

  // Small tolerance to avoid flicker on exact boundaries.
  const tolerance = 1
  return mouse.x >= minX - tolerance && mouse.x <= maxX + tolerance
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

interface MousePosition {
  readonly x: number
  readonly y: number
}

interface HoverMeasure {
  readonly hoverRange: SourceRange | undefined
  readonly underlineRange: SourceRange | undefined
}

interface MeasureRequest<T> {
  readonly read: (view: EditorView) => T
  readonly write?: (measure: T, view: EditorView) => void
  readonly key?: unknown
}

class GoToDefinitionInteractionsPlugin {
  private readonly view: EditorView

  private readonly hoverMeasureRequest: MeasureRequest<HoverMeasure>

  private lastMousePosition: MousePosition | undefined
  private modifierHeld = false
  private lastHoverRange: SourceRange | undefined
  private lastDispatchedRange: SourceRange | undefined
  private pendingHoverDispatchRange: SourceRange | undefined
  private hoverDispatchScheduled = false

  constructor (view: EditorView) {
    this.view = view

    this.hoverMeasureRequest = {
      key: this,

      read: (view: EditorView): HoverMeasure => {
        if (!this.modifierHeld || this.lastMousePosition == null) {
          return { hoverRange: undefined, underlineRange: undefined }
        }

        const position = view.posAtCoords(this.lastMousePosition)
        if (position == null) {
          return { hoverRange: undefined, underlineRange: undefined }
        }

        const tree = syntaxTree(view.state)
        const hoverRange = findIdentifierRangeAt(tree, view.state.doc, position)
        if (hoverRange == null) {
          return { hoverRange: undefined, underlineRange: undefined }
        }

        // Don't treat trailing whitespace (right of token) as hovering the token.
        if (!rangeContainsMouseX(view, hoverRange, this.lastMousePosition)) {
          return { hoverRange: undefined, underlineRange: undefined }
        }

        const target = applySemanticOperation(goToDefinition, tree, view.state.doc, position)
        const underlineRange = target == null ? undefined : hoverRange

        return { hoverRange, underlineRange }
      },

      write: (measure: HoverMeasure) => {
        this.lastHoverRange = measure.hoverRange
        this.scheduleHoverDispatch(measure.underlineRange)
      }
    }
  }

  update (update: ViewUpdate): void {
    if (!update.docChanged) {
      return
    }

    this.lastHoverRange = undefined

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
    this.lastHoverRange = undefined
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
      this.lastHoverRange = undefined
      this.scheduleHoverDispatch(undefined)
    }
  }

  onMouseDown (event: MouseEvent): void {
    if (event.button !== 0 || !isPrimaryModifierPressed(event)) {
      return
    }

    const mouse = { x: event.clientX, y: event.clientY }
    const position = this.view.posAtCoords(mouse)
    if (position == null) {
      return
    }

    const tree = syntaxTree(this.view.state)
    const hoverRange = findIdentifierRangeAt(tree, this.view.state.doc, position)
    if (hoverRange == null || !rangeContainsMouseX(this.view, hoverRange, mouse)) {
      return
    }

    const target = applySemanticOperation(goToDefinition, tree, this.view.state.doc, position)
    if (target == null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const selection = EditorSelection.single(target.offset)
    this.view.dispatch({ selection, scrollIntoView: true })
    this.view.focus()
  }

  private refreshHover (): void {
    if (!this.modifierHeld || this.lastMousePosition == null) {
      this.scheduleHoverDispatch(undefined)
      return
    }

    const position = this.view.posAtCoords(this.lastMousePosition)
    if (position == null) {
      this.scheduleHoverDispatch(undefined)
      return
    }

    const range = findIdentifierRangeAt(syntaxTree(this.view.state), this.view.state.doc, position)

    if (range == null || !rangeContainsMouseX(this.view, range, this.lastMousePosition)) {
      this.lastHoverRange = undefined
      this.scheduleHoverDispatch(undefined)
      return
    }

    if (this.lastHoverRange != null && sameRange(range, this.lastHoverRange)) {
      return
    }

    this.lastHoverRange = range

    // Only underline identifiers that actually resolve.
    const tree = syntaxTree(this.view.state)
    const target = applySemanticOperation(goToDefinition, tree, this.view.state.doc, position)
    if (target == null) {
      this.scheduleHoverDispatch(undefined)
      return
    }

    this.scheduleHoverDispatch(range)
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

      if (!this.view.dom.isConnected) {
        return
      }

      this.dispatchHover(next)
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
