import type { ThemeSetting } from '@editor/state.js'
import { useEffect, useState } from 'react'

const DARK_THEME = 'dark'
const LIGHT_THEME = 'light'

export const themes = Object.freeze([DARK_THEME, LIGHT_THEME] as const)
export type Theme = typeof themes[number]

const THEME_TRANSITION_DURATION_MS = 200

const prefersLightColorScheme = window.matchMedia('(prefers-color-scheme: light)')
prefersLightColorScheme.addEventListener('change', () => updateTheme())

export function useTheme (): Theme {
  return getTheme() ?? getSystemTheme()
}

export function applyThemeSetting (setting: ThemeSetting): void {
  document.documentElement.setAttribute('data-theme-setting', setting)
  updateTheme()
}

export function useSystemTheme (): Theme {
  const [theme, setTheme] = useState<Theme>(() => getSystemTheme())

  useEffect(() => {
    const listener = () => {
      setTheme(getSystemTheme())
    }

    prefersLightColorScheme.addEventListener('change', listener)

    return () => {
      prefersLightColorScheme.removeEventListener('change', listener)
    }
  }, [])

  return theme
}

function getSystemTheme (): Theme {
  return prefersLightColorScheme.matches ? LIGHT_THEME : DARK_THEME
}

function getTheme (): Theme | undefined {
  if (document.documentElement.classList.contains(LIGHT_THEME)) {
    return LIGHT_THEME
  }

  if (document.documentElement.classList.contains(DARK_THEME)) {
    return DARK_THEME
  }

  return undefined
}

function updateTheme (): void {
  const setting = document.documentElement.getAttribute('data-theme-setting')
  const theme = setting === DARK_THEME || setting === LIGHT_THEME ? setting : getSystemTheme()

  const previousTheme = getTheme()
  if (previousTheme === theme) {
    return
  }

  if (previousTheme != null) {
    document.documentElement.classList.add('theme-transition')

    setTimeout(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-transition')
      })
    }, THEME_TRANSITION_DURATION_MS)
  }

  document.documentElement.classList.toggle(LIGHT_THEME, theme === LIGHT_THEME)
  document.documentElement.classList.toggle(DARK_THEME, theme === DARK_THEME)
}
