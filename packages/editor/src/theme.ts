/**
 * The content in this file was adapted from the One Dark theme for CodeMirror 6.
 * It has modified for use in this project.
 *
 * Original source:
 * https://github.com/codemirror/theme-one-dark
 * Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others
 * Licensed under the MIT License.
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

const darkColors = {
  comment: '#7d8799',
  keyword: '#ca78e0',
  operator: '#c2b9c8',

  variableName: '#f67386',
  propertyName: '#d79a53',
  functionName: '#cdb17b',

  number: '#68aff6',
  string: '#a0c27a',
  pattern: '#a0c27a',

  invalid: '#ffffff',
  background: '#1d1f20',
  foreground: '#abb2bf',
  panelBackground: '#21252b',
  foldPlaceholder: '#ddd',
  gutters: '#7d8799',
  selection: '#3e4451',
  highlightBackground: '#2c313a',
  activeLineBackground: '#6688ee0b',
  tooltipBackground: '#353a42',
  cursor: '#528bff',
  matchingBracket: '#bad0f847',
  selectionMatchBackground: '#aafe661a'
}

const lightColors = {
  ...darkColors,

  comment: '#6a717e',
  keyword: '#8400a1',
  operator: '#20245f',

  variableName: '#981706',
  propertyName: '#824002',
  functionName: '#9a6b08',

  number: '#0954de',
  string: '#0a7d10',
  pattern: '#0a7d10',

  invalid: '#000000',
  background: '#ffffff',
  foreground: '#383a42',
  panelBackground: '#e7e8ea',
  foldPlaceholder: '#555',
  gutters: '#6a717e',
  selection: '#b8d4f6',
  highlightBackground: '#cccfd4',
  activeLineBackground: '#2031640b',
  tooltipBackground: '#f7f7f8',
  cursor: '#526eff',
  matchingBracket: '#7894e847',
  selectionMatchBackground: '#504ebf22'
}

// The editor theme styles for this theme.
const cadenceEditorTheme = (dark: boolean) => {
  const colors = dark ? darkColors : lightColors

  return EditorView.theme({
    '&': {
      color: colors.foreground,
      backgroundColor: colors.background
    },

    '.cm-content': {
      caretColor: colors.cursor
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: colors.cursor
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: colors.selection
    },

    '.cm-panels': {
      backgroundColor: colors.panelBackground,
      color: colors.foreground
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '2px solid black'
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '2px solid black'
    },

    '.cm-searchMatch': {
      backgroundColor: '#72a1ff59',
      outline: '1px solid #457dff'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#6199ff2f'
    },

    '.cm-activeLine': {
      backgroundColor: colors.activeLineBackground
    },
    '.cm-selectionMatch': {
      backgroundColor: colors.selectionMatchBackground
    },

    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: colors.matchingBracket
    },

    '.cm-gutters': {
      backgroundColor: colors.background,
      color: colors.gutters,
      border: 'none'
    },

    '.cm-activeLineGutter': {
      backgroundColor: colors.highlightBackground
    },

    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: colors.foldPlaceholder
    },

    '.cm-tooltip': {
      border: 'none',
      backgroundColor: colors.tooltipBackground
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent'
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: colors.tooltipBackground,
      borderBottomColor: colors.tooltipBackground
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: colors.highlightBackground,
        color: colors.foreground
      }
    }
  }, { dark })
}

// The highlighting style for code in this theme.
const cadenceThemeHighlightStyle = (dark: boolean) => {
  const colors = dark ? darkColors : lightColors

  return HighlightStyle.define([
    {
      tag: [t.meta, t.comment],
      color: colors.comment
    },
    {
      tag: t.keyword,
      color: colors.keyword
    },
    {
      tag: [t.operator, t.operatorKeyword],
      color: colors.operator
    },
    {
      tag: t.variableName,
      color: colors.variableName
    },
    {
      tag: t.propertyName,
      color: colors.propertyName
    },
    {
      tag: [t.function(t.name)],
      color: colors.functionName
    },
    {
      tag: [t.number],
      color: colors.number
    },
    {
      tag: [t.string],
      color: colors.string
    },
    {
      tag: [t.special(t.string)],
      color: colors.pattern
    }
  ])
}

export const cadenceDarkTheme: Extension = [
  cadenceEditorTheme(true),
  syntaxHighlighting(cadenceThemeHighlightStyle(true))
]

export const cadenceLightTheme: Extension = [
  cadenceEditorTheme(false),
  syntaxHighlighting(cadenceThemeHighlightStyle(false))
]
