import { gainToDb, getTransport, Sequence, Player, now } from 'tone'
import * as ast from '../language/ast.js'
import { combineLocations, getEmptyLocation } from '../language/location.js'

const BEATS_PER_BAR = 4
const STEPS_PER_BEAT = 4
const STEPS_PER_BAR = BEATS_PER_BAR * STEPS_PER_BEAT

export interface AudioDemo {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
  readonly setProgram: (program: ast.Program) => void
}

export function createAudioDemo (options: {
  defaultTempo: number
}): AudioDemo {
  let initialized = false

  const players = new Map<string, Player>()
  const sequences = new Map<string, Sequence<ast.Step>>()

  let decibels: number | undefined
  let program: ast.Program = {
    type: 'Program',
    location: getEmptyLocation(),
    track: undefined,
    assignments: []
  }

  const init = () => {
    if (initialized) {
      return
    }

    getTransport().start()
    initialized = true
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

  const createPlayers = () => {
    players.clear()

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

      const player = new Player({
        url: urlValue.value,
        autostart: false,
        loop: false
      }).toDestination()

      if (decibels != null) {
        player.volume.value = decibels
      }

      players.set(key, player)
    }
  }

  const createSequences = () => {
    const sequenceEvents = new Map<string, ast.Step[]>([
      ...players.keys()].map((key) => [key, [] as ast.Step[]
    ]))

    for (const section of program.track?.sections ?? []) {
      if (!Number.isSafeInteger(section.length.value) || section.length.value <= 0) {
        // TODO error handling - invalid section length
        continue
      }

      let sectionLengthSteps: number

      switch (section.length.unit) {
        case 'bars':
          sectionLengthSteps = section.length.value * STEPS_PER_BAR
          break

        case 'beats':
          sectionLengthSteps = section.length.value * STEPS_PER_BEAT
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
        const repeats = Math.ceil(sectionLengthSteps / pattern.value.length)
        const steps = new Array<readonly ast.Step[]>(repeats).fill(pattern.value).flat().slice(0, sectionLengthSteps)

        events.push(...steps)
      }

      // Handle instruments not used in this section by adding "rest" steps
      for (const [key, events] of sequenceEvents) {
        if (!instruments.has(key)) {
          events.push(...new Array<ast.Step>(sectionLengthSteps).fill('rest'))
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
      sequence.start(now() + 0.01)
    }
  }

  return {
    play: () => {
      init()

      configureTempo()

      createPlayers()
      createSequences()

      startSequences()
    },

    stop: () => {
      for (const sequence of sequences.values()) {
        sequence.stop()
      }
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

function computeBinaryExpression (operator: ast.BinaryOperator, left: ast.Value, right: ast.Value): ast.Value | undefined {
  if (left.type !== right.type) {
    // TODO error handling - type mismatch
    return undefined
  }

  switch (left.type) {
    case 'Identifier':
      throw new Error('Unexpected Identifier in computeBinaryExpression')

    case 'Call':
      // TODO error handling - unsupported operation
      return undefined

    case 'NumberLiteral': {
      if (left.unit !== (right as typeof left).unit) {
        // TODO error handling - unit mismatch
        return undefined
      }

      const result = computeArithmeticOperation(operator, left.value, (right as typeof left).value)
      if (result == null) {
        // TODO error handling - unsupported operation
        return undefined
      }

      return {
        type: 'NumberLiteral',
        location: combineLocations(left, right),
        value: result,
        unit: left.unit
      }
    }

    case 'StringLiteral': {
      const result = computeStringOperation(operator, left.value, (right as typeof left).value)
      if (result == null) {
        // TODO error handling - unsupported operation
        return undefined
      }

      return {
        type: 'StringLiteral',
        location: combineLocations(left, right),
        value: result
      }
    }

    case 'PatternLiteral': {
      const result = computePatternOperation(operator, left.value, (right as typeof left).value)
      if (result == null) {
        // TODO error handling - unsupported operation
        return undefined
      }

      return {
        type: 'PatternLiteral',
        location: combineLocations(left, right),
        value: result
      }
    }

    default:
      // @ts-expect-error - should be unreachable
      throw new Error(`Unexpected value type: ${left.type}`)
  }
}

function computeArithmeticOperation (operator: ast.BinaryOperator, left: number, right: number): number | undefined {
  switch (operator) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case '+':
      return left + right
  }
}

function computeStringOperation (operator: ast.BinaryOperator, left: string, right: string): string | undefined {
  switch (operator) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case '+':
      return left + right
  }
}

function computePatternOperation (operator: ast.BinaryOperator, left: readonly ast.Step[], right: readonly ast.Step[]): readonly ast.Step[] | undefined {
  switch (operator) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case '+':
      return [...left, ...right]
  }
}
