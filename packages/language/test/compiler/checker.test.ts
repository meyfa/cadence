import { ast, getEmptySourceRange } from '@ast'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../src/compiler/checker.js'
import { CompileError } from '../../src/compiler/error.js'

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
                  ast.make('PropertyAccess', RANGE, {
                    object: ast.make('Number', RANGE, { value: 4 }),
                    property: ast.make('Identifier', RANGE, { name: 'bars' })
                  })
                ],
                routings: [],
                automations: []
              }),
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'main' }),
                properties: [
                  ast.make('Property', RANGE, {
                    key: ast.make('Identifier', RANGE, { name: 'length' }),
                    value: ast.make('PropertyAccess', RANGE, {
                      object: ast.make('Number', RANGE, { value: 8 }),
                      property: ast.make('Identifier', RANGE, { name: 'bars' })
                    })
                  })
                ],
                routings: [],
                automations: []
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
            value: ast.make('PropertyAccess', RANGE, {
              object: ast.make('Number', RANGE, { value: 3 }),
              property: ast.make('Identifier', RANGE, { name: 'db' })
            })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [])
    })

    it('should accept delay effect time in beats or seconds', () => {
      const createDelayCall = (value: number, unit: 'beats' | 's') => ast.make('Call', RANGE, {
        callee: ast.make('PropertyAccess', RANGE, {
          object: ast.make('Identifier', RANGE, { name: 'fx' }),
          property: ast.make('Identifier', RANGE, { name: 'delay' })
        }),
        arguments: [
          ast.make('Property', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'mix' }),
            value: ast.make('Number', RANGE, { value: 0.25 })
          }),
          ast.make('Property', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'time' }),
            value: ast.make('PropertyAccess', RANGE, {
              object: ast.make('Number', RANGE, { value }),
              property: ast.make('Identifier', RANGE, { name: unit })
            })
          }),
          ast.make('Property', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'feedback' }),
            value: ast.make('Number', RANGE, { value: 0.4 })
          })
        ]
      })

      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['effects'] }),
            alias: 'fx'
          })
        ],
        children: [
          ast.make('MixerStatement', RANGE, {
            properties: [],
            buses: [
              ast.make('BusStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'bus1' }),
                properties: [],
                sources: [],
                effects: [
                  ast.make('EffectStatement', RANGE, {
                    expression: createDelayCall(3, 'beats')
                  })
                ]
              }),
              ast.make('BusStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'bus2' }),
                properties: [],
                sources: [],
                effects: [
                  ast.make('EffectStatement', RANGE, {
                    expression: createDelayCall(1.5, 's')
                  })
                ]
              })
            ]
          })
        ]
      })

      assert.deepStrictEqual(check(program), [])
    })

    it('should accept reverb effect decay in beats or seconds', () => {
      const createReverbCall = (value: number, unit: 'beats' | 's') => ast.make('Call', RANGE, {
        callee: ast.make('PropertyAccess', RANGE, {
          object: ast.make('Identifier', RANGE, { name: 'fx' }),
          property: ast.make('Identifier', RANGE, { name: 'reverb' })
        }),
        arguments: [
          ast.make('Property', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'mix' }),
            value: ast.make('Number', RANGE, { value: 0.25 })
          }),
          ast.make('Property', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'decay' }),
            value: ast.make('PropertyAccess', RANGE, {
              object: ast.make('Number', RANGE, { value }),
              property: ast.make('Identifier', RANGE, { name: unit })
            })
          })
        ]
      })

      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['effects'] }),
            alias: 'fx'
          })
        ],
        children: [
          ast.make('MixerStatement', RANGE, {
            properties: [],
            buses: [
              ast.make('BusStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'bus1' }),
                properties: [],
                sources: [],
                effects: [
                  ast.make('EffectStatement', RANGE, {
                    expression: createReverbCall(3, 'beats')
                  })
                ]
              }),
              ast.make('BusStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'bus2' }),
                properties: [],
                sources: [],
                effects: [
                  ast.make('EffectStatement', RANGE, {
                    expression: createReverbCall(1.5, 's')
                  })
                ]
              })
            ]
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
                  ast.make('PropertyAccess', RANGE, {
                    object: ast.make('Number', RANGE, { value: 4 }),
                    property: ast.make('Identifier', RANGE, { name: 'bars' })
                  })
                ],
                routings: [],
                automations: []
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

    it('should accept curve automation with lin curve type', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['instruments'] })
          })
        ],
        children: [
          // synth = sample("synth.wav")
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'synth' }),
            value: ast.make('Call', RANGE, {
              callee: ast.make('Identifier', RANGE, { name: 'sample' }),
              arguments: [
                ast.make('String', RANGE, { parts: ['synth.wav'] })
              ]
            })
          }),
          ast.make('TrackStatement', RANGE, {
            properties: [],
            parts: [
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                properties: [
                  // (4.bars)
                  ast.make('PropertyAccess', RANGE, {
                    object: ast.make('Number', RANGE, { value: 4 }),
                    property: ast.make('Identifier', RANGE, { name: 'bars' })
                  })
                ],
                routings: [],
                automations: [
                  ast.make('AutomateStatement', RANGE, {
                    target: ast.make('PropertyAccess', RANGE, {
                      object: ast.make('Identifier', RANGE, { name: 'synth' }),
                      property: ast.make('Identifier', RANGE, { name: 'gain' })
                    }),
                    curve: ast.make('Curve', RANGE, {
                      children: [
                        ast.make('CurveSegment', RANGE, {
                          curveType: 'lin',
                          parameters: [
                            ast.make('PropertyAccess', RANGE, {
                              object: ast.make('Number', RANGE, { value: -60 }),
                              property: ast.make('Identifier', RANGE, { name: 'db' })
                            }),
                            ast.make('PropertyAccess', RANGE, {
                              object: ast.make('Number', RANGE, { value: 0 }),
                              property: ast.make('Identifier', RANGE, { name: 'db' })
                            })
                          ]
                        })
                      ]
                    })
                  })
                ]
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

    it('should reject unknown module export access', () => {
      const program = ast.make('Program', RANGE, {
        imports: [
          ast.make('UseStatement', RANGE, {
            library: ast.make('String', RANGE, { parts: ['instruments'] }),
            alias: 'inst'
          })
        ],
        children: [
          ast.make('Assignment', RANGE, {
            key: ast.make('Identifier', RANGE, { name: 'myinstrument' }),
            value: ast.make('PropertyAccess', RANGE, {
              object: ast.make('Identifier', RANGE, { name: 'inst' }),
              property: ast.make('Identifier', RANGE, { name: 'foobar' })
            })
          })
        ]
      })
      assert.deepStrictEqual(check(program), [
        new CompileError('Module "instruments" has no export named "foobar"', RANGE)
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
                value: ast.make('PropertyAccess', RANGE, {
                  object: ast.make('Number', RANGE, { value: 120 }),
                  property: ast.make('Identifier', RANGE, { name: 'bpm' })
                })
              }),
              ast.make('Property', RANGE, {
                key: ast.make('Identifier', RANGE, { name: 'tempo' }),
                value: ast.make('PropertyAccess', RANGE, {
                  object: ast.make('Number', RANGE, { value: 120 }),
                  property: ast.make('Identifier', RANGE, { name: 'bpm' })
                })
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
                  ast.make('PropertyAccess', RANGE, {
                    object: ast.make('Number', RANGE, { value: 4 }),
                    property: ast.make('Identifier', RANGE, { name: 'bars' })
                  })
                ],
                routings: [],
                automations: []
              }),
              ast.make('PartStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                properties: [
                  ast.make('PropertyAccess', RANGE, {
                    object: ast.make('Number', RANGE, { value: 8 }),
                    property: ast.make('Identifier', RANGE, { name: 'bars' })
                  })
                ],
                routings: [],
                automations: []
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

  it('should reject cyclic mixer routings', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('MixerStatement', RANGE, {
          properties: [],
          buses: [
            // bus1 -> bus3 -> bus2 -> bus1
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'bus1' }),
              properties: [],
              sources: [
                ast.make('Identifier', RANGE, { name: 'bus3' })
              ],
              effects: []
            }),
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'bus2' }),
              properties: [],
              sources: [
                ast.make('Identifier', RANGE, { name: 'bus1' })
              ],
              effects: []
            }),
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'bus3' }),
              properties: [],
              sources: [
                ast.make('Identifier', RANGE, { name: 'bus2' })
              ],
              effects: []
            })
          ]
        })
      ]
    })
    assert.deepStrictEqual(check(program), [
      new CompileError('Cyclic routing: bus1 -> bus3 -> bus2 -> bus1', RANGE)
    ])
  })

  it('should only report buses that are part of a cycle', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('MixerStatement', RANGE, {
          properties: [],
          buses: [
            // first -> bus1 <-> bus2 (first is NOT part of the cycle)
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'first' }),
              properties: [],
              sources: [
                ast.make('Identifier', RANGE, { name: 'bus1' })
              ],
              effects: []
            }),
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
              sources: [
                ast.make('Identifier', RANGE, { name: 'bus1' })
              ],
              effects: []
            })
          ]
        })
      ]
    })
    assert.deepStrictEqual(check(program), [
      new CompileError('Cyclic routing: bus1 -> bus2 -> bus1', RANGE)
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
              ast.make('Number', RANGE, { value: 42 }),
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
