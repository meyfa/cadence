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
  chalky: '#e5c07b',
  coral: '#e06c75',
  cyan: '#56b6c2',
  ivory: '#abb2bf',
  stone: '#7d8799',
  malibu: '#61afef',
  sage: '#98c379',
  whiskey: '#d19a66',
  violet: '#c678dd',

  invalid: '#ffffff',
  background: '#1d1f20',
  foreground: '#abb2bf',
  panelBackground: '#21252b',
  foldPlaceholder: '#ddd',
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

  chalky: '#a38200',
  coral: '#c0413a',
  cyan: '#007ac1',
  ivory: '#383a62',
  stone: '#6a717e',
  malibu: '#0066ff',
  sage: '#30911f',
  whiskey: '#276f86',
  violet: '#a62694',

  invalid: '#000000',
  background: '#eff0f1',
  foreground: '#383a42',
  panelBackground: '#e7e8ea',
  foldPlaceholder: '#555',
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
      color: colors.stone,
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
      tag: t.keyword,
      color: colors.violet
    },
    {
      tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
      color: colors.coral
    },
    {
      tag: [t.function(t.variableName), t.labelName],
      color: colors.malibu
    },
    {
      tag: [t.color, t.constant(t.name), t.standard(t.name)],
      color: colors.whiskey
    },
    {
      tag: [t.definition(t.name), t.separator],
      color: colors.ivory
    },
    {
      tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
      color: colors.chalky
    },
    {
      tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.special(t.string)],
      color: colors.cyan
    },
    {
      tag: [t.meta, t.comment],
      color: colors.stone
    },
    {
      tag: t.strong,
      fontWeight: 'bold'
    },
    {
      tag: t.emphasis,
      fontStyle: 'italic'
    },
    {
      tag: t.strikethrough,
      textDecoration: 'line-through'
    },
    {
      tag: t.link,
      color: colors.stone,
      textDecoration: 'underline'
    },
    {
      tag: t.heading,
      fontWeight: 'bold',
      color: colors.coral
    },
    {
      tag: [t.atom, t.bool, t.special(t.variableName)],
      color: colors.whiskey
    },
    {
      tag: [t.processingInstruction, t.string, t.inserted],
      color: colors.sage
    },
    {
      tag: t.invalid,
      color: colors.invalid
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
