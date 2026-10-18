import assert from 'node:assert'
import { describe, it } from 'node:test'
import { getDefaultFileName, getEncodingOptions, getExportFields, getExportFormValue, getFileType, getLeadingSilence, getSampleRate, updateExportForm } from '../../../src/modules/export/form.ts'

describe('modules/export/form.ts', () => {
  describe('getExportFields()', () => {
    it('returns WAV fields by default', () => {
      const keys = getExportFields({}).map((field) => field.key)
      assert.deepStrictEqual(keys, ['type', 'wav.format', 'sampleRate', 'leadingSilence'])
    })

    it('returns AIFF fields when AIFF is selected', () => {
      const keys = getExportFields({ type: 'aiff' }).map((field) => field.key)
      assert.deepStrictEqual(keys, ['type', 'aiff.format', 'sampleRate', 'leadingSilence'])
    })
  })

  describe('getExportFormValue()', () => {
    const [typeField] = getExportFields({})

    it('returns the first option when no value is set', () => {
      assert.strictEqual(getExportFormValue({}, typeField), 'wav')
    })

    it('returns the stored value', () => {
      assert.strictEqual(getExportFormValue({ type: 'aiff' }, typeField), 'aiff')
    })

    it('ignores non-string values', () => {
      assert.strictEqual(getExportFormValue({ type: 42 }, typeField), 'wav')
    })

    it('throws if there is no value and no options', () => {
      const field = { key: 'empty', label: 'Empty', options: [] }
      assert.throws(() => getExportFormValue({}, field), /empty/)
    })
  })

  describe('updateExportForm()', () => {
    const [typeField] = getExportFields({})

    it('sets the field value without mutating the original form', () => {
      const form = Object.freeze({ sampleRate: '48000' })
      const updated = updateExportForm(form, typeField, 'aiff')

      assert.deepStrictEqual(updated, { sampleRate: '48000', type: 'aiff' })
      assert.deepStrictEqual(form, { sampleRate: '48000' })
    })
  })

  describe('getFileType()', () => {
    it('defaults to WAV', () => {
      assert.strictEqual(getFileType({}).extension, 'wav')
    })

    it('returns AIFF when selected', () => {
      assert.strictEqual(getFileType({ type: 'aiff' }).extension, 'aiff')
    })

    it('throws for unknown types', () => {
      assert.throws(() => getFileType({ type: 'mp3' }), TypeError)
    })
  })

  describe('getDefaultFileName()', () => {
    it('uses the file type extension', () => {
      assert.strictEqual(getDefaultFileName(getFileType({})), 'track.wav')
      assert.strictEqual(getDefaultFileName(getFileType({ type: 'aiff' })), 'track.aiff')
    })
  })

  describe('getSampleRate()', () => {
    it('defaults to 44100', () => {
      assert.strictEqual(getSampleRate({}), 44100)
    })

    it('parses the selected value', () => {
      assert.strictEqual(getSampleRate({ sampleRate: '96000' }), 96000)
    })
  })

  describe('getLeadingSilence()', () => {
    it('defaults to none', () => {
      assert.strictEqual(getLeadingSilence({}), 0)
    })

    it('parses the selected value', () => {
      assert.strictEqual(getLeadingSilence({ leadingSilence: '0.250' }), 0.25)
    })
  })

  describe('getEncodingOptions()', () => {
    it('returns the WAV format for WAV', () => {
      const form = { 'wav.format': 'pcm24', 'aiff.format': 'pcm16' }
      const type = getFileType(form)
      assert.deepStrictEqual(getEncodingOptions(form, type), { format: 'pcm24' })
    })

    it('returns the AIFF format for AIFF', () => {
      const form = { type: 'aiff', 'wav.format': 'pcm24', 'aiff.format': 'pcm16' }
      const type = getFileType(form)
      assert.deepStrictEqual(getEncodingOptions(form, type), { format: 'pcm16' })
    })

    it('defaults to the first format option', () => {
      const form = {}
      const type = getFileType(form)
      assert.deepStrictEqual(getEncodingOptions(form, type), { format: 'float32' })
    })
  })
})
