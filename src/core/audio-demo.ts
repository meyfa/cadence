import { gainToDb, getTransport, Sequence, Player } from 'tone'
import * as ast from '../language/ast.js'
import { combineLocations, getEmptyLocation, type Location } from '../language/location.js'

const BEATS_PER_BAR = 4
const STEPS_PER_BEAT = 4
const STEPS_PER_BAR = BEATS_PER_BAR * STEPS_PER_BEAT

const LOAD_TIMEOUT_MS = 3000

export interface AudioDemo {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
  readonly setProgram: (program: ast.Program) => void
}

export function createAudioDemo (options: {
  defaultTempo: number
}): AudioDemo {
  const players = new Map<string, Player>()
  const sequences = new Map<string, Sequence<ast.Step>>()

  // Increments on play() and stop(), to cancel pending playback
  let playSession = 0

  let decibels: number | undefined
  let program: ast.Program = {
    type: 'Program',
    location: getEmptyLocation(),
    track: undefined,
    assignments: []
  }

  const resetTransport = () => {
    const transport = getTransport()
    transport.stop()
    transport.cancel()
    transport.position = 0
  }

  const configureTempo = () => {
    let tempo = options.defaultTempo

    const tempoProperty = findProperty(program.track?.properties ?? [], 'tempo')
    const tempoValue = tempoProperty != null ? resolveExpression(tempoProperty, program) : undefined
    if (tempoValue != null && tempoValue.type === 'NumberLiteral' && tempoValue.unit === 'bpm') {
      const { value } = tempoValue
      if (Number.isFinite(value) && value > 1 && value <= 400) {
        tempo = value
      }
    }

    getTransport().bpm.value = tempo
  }

  const createPlayers = (): Array<Promise<Player>> => {
    players.clear()

    const loads: Array<Promise<Player>> = []

    for (const assignment of program.assignments) {
      const key = assignment.key.name

      if (assignment.value.type !== 'Call' || assignment.value.callee.name !== 'sample') {
        // TODO handle other types of assignments
        continue
      }

      const urlArgument = findProperty(assignment.value.arguments, 'url')
      const urlValue = urlArgument != null ? resolveExpression(urlArgument, program) : undefined
      if (urlValue == null || urlValue.type !== 'StringLiteral') {
        // TODO handle invalid or missing url
        continue
      }

      const player = new Player({ autostart: false, loop: false }).toDestination()
      loads.push(player.load(urlValue.value))

      if (decibels != null) {
        player.volume.value = decibels
      }

      players.set(key, player)
    }

    return loads
  }

  const waitForLoadsOrTimeout = async (loads: Array<Promise<Player>>, timeoutMs: number): Promise<void> => {
    if (loads.length === 0) {
      return
    }

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    const loadsIgnoreErrors = Promise.allSettled(loads.map((p) => p.catch(() => {})))

    await Promise.race([loadsIgnoreErrors, timeout])
  }

  const createSequences = () => {
    const sequenceEvents = new Map<string, ast.Step[]>([
      ...players.keys()].map((key) => [key, [] as ast.Step[]
    ]))

    for (const section of program.track?.sections ?? []) {
      const lengthValue = resolveExpression(section.length, program)
      if (lengthValue == null || lengthValue.type !== 'NumberLiteral') {
        // TODO error handling - invalid section length
        continue
      }

      let sectionLengthSteps: number

      switch (lengthValue.unit) {
        case 'bars':
          sectionLengthSteps = lengthValue.value * STEPS_PER_BAR
          break

        case 'beats':
          sectionLengthSteps = lengthValue.value * STEPS_PER_BEAT
          break

        default:
          // TODO error handling - unsupported section length unit
          continue
      }

      // Remember which instruments were used in this section
      const instruments = new Set<string>()

      for (const routing of section.routings) {
        const key = routing.instrument.name
        if (instruments.has(key)) {
          // TODO handle duplicate instrument in same section
          continue
        }

        instruments.add(key)

        const player = players.get(key)
        if (player == null) {
          // TODO handle missing instrument
          continue
        }

        const pattern = resolveExpression(routing.pattern, program)
        if (pattern == null || pattern.type !== 'PatternLiteral') {
          // TODO handle invalid pattern
          continue
        }

        const events = sequenceEvents.get(key)
        if (events == null) {
          // TODO handle missing instrument
          continue
        }

        // Expand pattern to fit section length
        events.push(...withPatternLength(pattern, sectionLengthSteps))
      }

      // Handle instruments not used in this section by adding "rest" steps
      for (const [key, events] of sequenceEvents) {
        if (!instruments.has(key)) {
          events.push(...getSilentPattern(sectionLengthSteps))
        }
      }
    }

    sequences.clear()

    for (const [key, player] of players) {
      const events = sequenceEvents.get(key) ?? []

      sequences.set(key, new Sequence<ast.Step>((time, note) => {
        if (note === 'hit') {
          player.start(time)
        }
      }, events, '16n'))
    }
  }

  const startSequences = () => {
    for (const sequence of sequences.values()) {
      sequence.start()
    }
  }

  return {
    play: () => {
      const session = ++playSession

      resetTransport()

      configureTempo()
      const loads = createPlayers()
      createSequences()

      // Defer start until samples are loaded or timeout reached
      waitForLoadsOrTimeout(loads, LOAD_TIMEOUT_MS).then(() => {
        // If stop() was called or a newer play() started, abort
        if (session !== playSession) {
          return
        }

        startSequences()
        getTransport().start('+0.05')
      }).catch((_err: unknown) => {
        // ignore
      })
    },

    stop: () => {
      // Invalidate any pending start from a previous play()
      ++playSession

      for (const sequence of sequences.values()) {
        sequence.stop()
        sequence.dispose()
      }

      sequences.clear()
      resetTransport()
    },

    setVolume: (volume: number) => {
      decibels = gainToDb(Math.pow(volume, 2))

      for (const player of players.values()) {
        player.volume.rampTo(decibels, 0.05)
      }
    },

    setProgram: (newProgram) => {
      program = newProgram
    }
  }
}

function findProperty (properties: readonly ast.Property[], key: string): ast.Property['value'] | undefined {
  return properties.find((prop) => prop.key.name === key)?.value
}

function resolveExpression (expression: ast.Expression, program: ast.Program, traversedVariables = new Set<string>()): ast.Value | undefined {
  switch (expression.type) {
    case 'Identifier': {
      if (traversedVariables.has(expression.name)) {
        // TODO error handling - circular reference
        return undefined
      }

      traversedVariables.add(expression.name)

      const value = program.assignments.find((a) => a.key.name === expression.name)?.value
      if (value == null) {
        // TODO error handling - undefined variable
        return undefined
      }

      return resolveExpression(value, program, traversedVariables)
    }

    case 'BinaryExpression': {
      const left = resolveExpression(expression.left, program, new Set(traversedVariables))
      const right = resolveExpression(expression.right, program, new Set(traversedVariables))

      if (left == null || right == null) {
        // TODO error handling - unable to resolve sub-expression
        return undefined
      }

      return computeBinaryExpression(expression.operator, left, right)
    }

    default:
      return expression
  }
}

interface CommonUnit {
  unit: ast.Unit | undefined
  scaleLeft: number
  scaleRight: number
}

function getCommonUnit (left: ast.NumberLiteral, right: ast.NumberLiteral): CommonUnit | undefined {
  // Both have the same unit, or both have no unit
  if (left.unit === right.unit) {
    return { unit: left.unit, scaleLeft: 1, scaleRight: 1 }
  }

  // One has a unit, the other doesn't - not compatible
  if (left.unit == null || right.unit == null) {
    return undefined
  }

  // Different units; some special cases are supported
  if (left.unit === 's' && right.unit === 'ms') {
    return { unit: 'ms', scaleLeft: 1000, scaleRight: 1 }
  }

  if (left.unit === 'ms' && right.unit === 's') {
    return { unit: 'ms', scaleLeft: 1, scaleRight: 1000 }
  }

  if (left.unit === 'beats' && right.unit === 'bars') {
    return { unit: 'beats', scaleLeft: 1, scaleRight: BEATS_PER_BAR }
  }

  if (left.unit === 'bars' && right.unit === 'beats') {
    return { unit: 'beats', scaleLeft: BEATS_PER_BAR, scaleRight: 1 }
  }

  return undefined
}

function computeBinaryExpression (operator: ast.BinaryOperator, left: ast.Value, right: ast.Value): ast.Value | undefined {
  if (left.type === 'Identifier' || right.type === 'Identifier') {
    throw new Error('Unable to compute with unresolved Identifier')
  }

  if (left.type === 'Call' || right.type === 'Call') {
    // TODO error handling
    return undefined
  }

  const location = combineLocations(left, right)

  switch (operator) {
    case '+':
      return computePlus(left, right, location)
    case '-':
      return computeMinus(left, right, location)
    case '*':
      return computeMultiply(left, right, location)
    case '/':
      return computeDivide(left, right, location)
  }
}

function computePlus (left: ast.Literal, right: ast.Literal, location: Location): ast.Literal | undefined {
  if (left.type === 'StringLiteral' && right.type === 'StringLiteral') {
    return {
      type: 'StringLiteral',
      location,
      value: left.value + right.value
    }
  }

  if (left.type === 'PatternLiteral' && right.type === 'PatternLiteral') {
    return {
      type: 'PatternLiteral',
      location,
      value: [...left.value, ...right.value]
    }
  }

  if (left.type === 'NumberLiteral' && right.type === 'NumberLiteral') {
    const common = getCommonUnit(left, right)
    if (common == null) {
      // TODO error handling - incompatible units
      return undefined
    }

    return {
      type: 'NumberLiteral',
      location,
      value: left.value * common.scaleLeft + right.value * common.scaleRight,
      unit: common.unit
    }
  }

  // TODO error handling - incompatible types
  return undefined
}

function computeMinus (left: ast.Literal, right: ast.Literal, location: Location): ast.Literal | undefined {
  if (left.type === 'NumberLiteral' && right.type === 'NumberLiteral') {
    const common = getCommonUnit(left, right)
    if (common == null) {
      // TODO error handling - incompatible units
      return undefined
    }

    return {
      type: 'NumberLiteral',
      location,
      value: left.value * common.scaleLeft - right.value * common.scaleRight,
      unit: common.unit
    }
  }

  // TODO error handling - incompatible types
  return undefined
}

function computeMultiply (left: ast.Literal, right: ast.Literal, location: Location): ast.Literal | undefined {
  if (left.type === 'NumberLiteral' && right.type === 'NumberLiteral') {
    // Multiplication only supported when (at least) one of the values is unitless
    if (left.unit != null && right.unit != null) {
      // TODO error handling - incompatible units
      return undefined
    }

    return {
      type: 'NumberLiteral',
      location,
      value: left.value * right.value,
      unit: left.unit ?? right.unit
    }
  }

  if (left.type === 'PatternLiteral' && right.type === 'NumberLiteral' && right.unit == null) {
    return {
      type: 'PatternLiteral',
      location,
      value: withPatternLength(left, left.value.length * right.value)
    }
  }

  if (left.type === 'NumberLiteral' && left.unit == null && right.type === 'PatternLiteral') {
    return {
      type: 'PatternLiteral',
      location,
      value: withPatternLength(right, right.value.length * left.value)
    }
  }

  // TODO error handling - incompatible types
  return undefined
}

function computeDivide (left: ast.Literal, right: ast.Literal, location: Location): ast.Literal | undefined {
  if (left.type === 'NumberLiteral' && right.type === 'NumberLiteral') {
    if (right.value === 0) {
      // TODO error handling - division by zero
      return undefined
    }

    // Equal units cancel out; unequal units are not compatible
    if (left.unit != null && right.unit != null) {
      if (left.unit !== right.unit) {
        // TODO error handling - incompatible units
        return undefined
      }

      return {
        type: 'NumberLiteral',
        location,
        value: left.value / right.value,
        unit: undefined
      }
    }

    // Disallow divisor with unit
    if (right.unit != null) {
      // TODO error handling - incompatible units
      return undefined
    }

    return {
      type: 'NumberLiteral',
      location,
      value: left.value / right.value,
      unit: left.unit
    }
  }

  if (left.type === 'PatternLiteral' && right.type === 'NumberLiteral' && right.unit == null) {
    if (right.value <= 0 || !Number.isFinite(right.value)) {
      // TODO error handling - invalid divisor
      return undefined
    }

    return {
      type: 'PatternLiteral',
      location,
      value: withPatternLength(left, left.value.length / right.value)
    }
  }

  // TODO error handling - incompatible types
  return undefined
}

function withPatternLength (pattern: ast.PatternLiteral, length: number): readonly ast.Step[] {
  const len = Math.floor(length)
  if (!Number.isSafeInteger(len) || len <= 0) {
    return []
  }

  if (pattern.value.length === len) {
    return pattern.value
  }

  if (pattern.value.length === 0) {
    return getSilentPattern(len)
  }

  const repeats = Math.ceil(len / pattern.value.length)
  return new Array<readonly ast.Step[]>(repeats).fill(pattern.value).flat().slice(0, len)
}

function getSilentPattern (length: number): readonly ast.Step[] {
  const len = Math.floor(length)
  if (!Number.isSafeInteger(len) || len <= 0) {
    return []
  }

  return new Array<ast.Step>(len).fill('rest')
}
