import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createProjectSourceState, getProjectFileContent, setProjectFileContent } from '../../src/project-source/model.js'

describe('project-source/model.ts', () => {
  it('should create and read project files', () => {
    const state = createProjectSourceState({
      'file1.foo': 'Hello, World!',
      'file2.bar': 'test'
    })

    assert.strictEqual(getProjectFileContent(state, 'file1.foo'), 'Hello, World!')
    assert.strictEqual(getProjectFileContent(state, 'file2.bar'), 'test')
    assert.strictEqual(getProjectFileContent(state, 'missing.baz'), undefined)
  })

  it('should update file content immutably and preserve identity for unchanged values', () => {
    const state = createProjectSourceState({
      'file1.foo': 'Hello, World!'
    })

    const unchangedState = setProjectFileContent(state, 'file1.foo', 'Hello, World!')
    const updatedState = setProjectFileContent(state, 'file1.foo', 'new content')

    assert.strictEqual(unchangedState, state)
    assert.notStrictEqual(updatedState, state)
    assert.strictEqual(getProjectFileContent(updatedState, 'file1.foo'), 'new content')
    assert.strictEqual(getProjectFileContent(state, 'file1.foo'), 'Hello, World!')
  })
})
