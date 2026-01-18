import { CompileError } from '@language/compiler/error.js'
import { getEmptySourceRange } from '@language/range.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../src/compiler/checker.js'
import * as ast from '../../src/parser/ast.js'

describe('compiler/checker.ts', () => {
  const RANGE = getEmptySourceRange()

  describe('valid', () => {
    it('should accept an empty program', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: []
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should accept use statements without alias', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['patterns'] })
          }),
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['effects'] })
          })
        ],
        children: []
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should define names from imported libraries', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['instruments'] })
          })
        ],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'myinstrument' }),
            value: ast.make('Call', RANGE, {
              callee: ast.make('Identifier', RANGE, { name: 'sample' }),
              arguments: [
                ast.make('String', RANGE, { parts: ['piano.wav'] })
              ]
            })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should accept imports with alias', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['effects'] }),
            alias: 'myalias'
          })
        ],
        children: []
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should accept a program with one track and unique parts', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('TrackStatement', RANGE, {
            properties: [],
            parts: [
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                properties: [
                  ast.make('Number', RANGE, { value: 4, unit: 'bars' })
                ],
                routings: []
              }),
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'main' }),
                properties: [
                  ast.make('Property', RANGE, {
                    key: ast.make('Identifier', RANGE, { name: 'length' }),
                    value: ast.make('Number', RANGE, { value: 8, unit: 'bars' })
                  })
                ],
                routings: []
              })
            ]
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should accept variable declarations and usages in correct order', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'foo' }),
            value: ast.make('Number', RANGE, { value: 42 })
          }),
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'bar' }),
            value: ast.make('Identifier', RANGE, { name: 'foo' })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should allow shadowing of imported names', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['effects'] })
          })
        ],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'gain' }),
            value: ast.make('Number', RANGE, { value: 3, unit: 'db' })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should allow parts and buses to shadow top-level variables', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'foo' }),
            value: ast.make('Number', RANGE, { value: 42 })
          }),
          ast.make('TrackStatement', RANGE, {
            properties: [],
            parts: [
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'foo' }),
                properties: [
                  ast.make('Number', RANGE, { value: 4, unit: 'bars' })
                ],
                routings: []
              })
            ]
          }),
          ast.make('MixerStatement', RANGE, {
            properties: [],
            buses: [
              ast.make('BusStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'foo' }),
                properties: [],
                sources: [],
                effects: []
              })
            ]
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should accept a pattern with interpolation', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'some_chord' }),
            value: ast.make('Pattern', RANGE, {
              mode: 'parallel',
              children: [
                ast.make('Step', RANGE, { value: 'D4', parameters: [] }),
                ast.make('Step', RANGE, { value: 'G4', parameters: [] })
              ]
            })
          }),
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'my_pattern' }),
            value: ast.make('Pattern', RANGE, {
              mode: 'serial',
              children: [
                ast.make('Step', RANGE, { value: 'C4', parameters: [] }),
                ast.make('BinaryExpression', RANGE, {
                  operator: '+',
                  left: ast.make('Identifier', RANGE, { name: 'some_chord' }),
                  right: ast.make('Pattern', RANGE, {
                    mode: 'parallel',
                    children: [
                      ast.make('Step', RANGE, { value: 'E4', parameters: [] }),
                      ast.make('Step', RANGE, { value: 'A4', parameters: [] })
                    ]
                  })
                }),
                ast.make('Step', RANGE, { value: 'E4', parameters: [] })
              ]
            })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should allow buses as sources in mixer', () => {
      // Should be possible even in reverse order
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('MixerStatement', RANGE, {
            properties: [],
            buses: [
              ast.make('BusStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'bus1' }),
                properties: [],
                sources: [
                  ast.make('Identifier', RANGE, { name: 'bus2' })
                ],
                effects: []
              }),
              ast.make('BusStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'bus2' }),
                properties: [],
                sources: [],
                effects: []
              })
            ]
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })
  })

  describe('invalid', () => {
    it('should reject imports of unknown libraries', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['unknownlib'] })
          })
        ],
        children: []
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Unknown module "unknownlib"', RANGE)
      ])
    })

    it('should reject duplicate non-alias imports', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['effects'] })
          }),
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['effects'] })
          })
        ],
        children: []
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Duplicate import of "effects"', RANGE)
      ])
    })

    it('should not define names from non-imported libraries', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'myinstrument' }),
            value: ast.make('Call', RANGE, {
              callee: ast.make('Identifier', RANGE, { name: 'sample' }),
              arguments: [
                ast.make('String', RANGE, { parts: ['piano.wav'] })
              ]
            })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Unknown identifier "sample"', RANGE)
      ])
    })

    it('should reject variable usage before declaration', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'foo' }),
            value: ast.make('Identifier', RANGE, { name: 'bar' })
          }),
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'bar' }),
            value: ast.make('Number', RANGE, { value: 100 })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Unknown identifier "bar"', RANGE)
      ])
    })

    it('should reject variable reassignment', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'foo' }),
            value: ast.make('Number', RANGE, { value: 42 })
          }),
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'foo' }),
            value: ast.make('Number', RANGE, { value: 100 })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Identifier "foo" is already defined', RANGE)
      ])
    })

    it('should reject duplicate track blocks', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('TrackStatement', RANGE, {
            properties: [],
            parts: []
          }),
          ast.make('TrackStatement', RANGE, {
            properties: [],
            parts: []
          })
        ]
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Multiple track definitions', RANGE),
        new CompileError('Multiple track definitions', RANGE)
      ])
    })

    it('should reject duplicate properties', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('TrackStatement', RANGE, {
            properties: [
              ast.make('Property', RANGE, {
                key: ast.make('Identifier', RANGE, { name: 'tempo' }),
                value: ast.make('Number', RANGE, { value: 120, unit: 'bpm' })
              }),
              ast.make('Property', RANGE, {
                key: ast.make('Identifier', RANGE, { name: 'tempo' }),
                value: ast.make('Number', RANGE, { value: 140, unit: 'bpm' })
              })
            ],
            parts: []
          })
        ]
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Duplicate property named "tempo"', RANGE)
      ])
    })

    it('should reject duplicate part blocks within a track', () => {
      const program = ast.make('Program', RANGE, {
        imports: [],
        children: [
          ast.make('TrackStatement', RANGE, {
            properties: [],
            parts: [
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                properties: [
                  ast.make('Number', RANGE, { value: 4, unit: 'bars' })
                ],
                routings: []
              }),
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                properties: [
                  ast.make('Number', RANGE, { value: 8, unit: 'bars' })
                ],
                routings: []
              })
            ]
          })
        ]
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Duplicate part named "intro"', RANGE)
      ])
    })
  })

  it('should reject duplicate mixer blocks', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('MixerStatement', RANGE, {
          properties: [],
          buses: []
        }),
        ast.make('MixerStatement', RANGE, {
          properties: [],
          buses: []
        })
      ]
    })
    assert.deepStrictEqual(check(program), [
      new CompileError('Multiple mixer definitions', RANGE),
      new CompileError('Multiple mixer definitions', RANGE)
    ])
  })

  it('should reject duplicate bus blocks within a mixer', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('MixerStatement', RANGE, {
          properties: [],
          buses: [
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              properties: [],
              sources: [],
              effects: []
            }),
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              properties: [],
              sources: [],
              effects: []
            })
          ]
        })
      ]
    })
    assert.deepStrictEqual(check(program), [
      new CompileError('Duplicate bus named "foo"', RANGE)
    ])
  })

  it('should reject patterns with interpolation of the wrong type', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'my_pattern' }),
          value: ast.make('Pattern', RANGE, {
            mode: 'serial',
            children: [
              ast.make('Step', RANGE, { value: 'C4', parameters: [] }),
              ast.make('Number', RANGE, { unit: undefined, value: 42 }),
              ast.make('Step', RANGE, { value: 'E4', parameters: [] })
            ]
          })
        })
      ]
    })
    assert.deepStrictEqual(check(program), [
      new CompileError('Expected type pattern, got number', RANGE)
    ])
  })
})
