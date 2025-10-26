import type { ThemeSetting } from '@editor/state.js'
import { useEffect, useState } from 'react'

const DARK_THEME = 'dark'
const LIGHT_THEME = 'light'

// system is a valid theme setting, but not a theme itself
const SYSTEM_THEME = 'system'

export const themes = Object.freeze([DARK_THEME, LIGHT_THEME] as const)
export type Theme = typeof themes[number]

const THEME_TRANSITION_DURATION_MS = 200

const prefersLightColorScheme = window.matchMedia('(prefers-color-scheme: light)')
prefersLightColorScheme.addEventListener('change', () => updateEffectiveTheme())

const themeSettingChangeListeners = new Set<() => void>()
const effectiveThemeChangeListeners = new Set<() => void>()

function dispatchThemeSettingChange (): void {
  for (const listener of themeSettingChangeListeners) {
    listener()
  }
}

function dispatchEffectiveThemeChange (): void {
  for (const listener of effectiveThemeChangeListeners) {
    listener()
  }
}

export function useThemeSetting (): ThemeSetting {
  const [setting, setSetting] = useState<ThemeSetting>(() => getThemeSetting())

  useEffect(() => {
    const listener = () => setSetting(getThemeSetting())
    themeSettingChangeListeners.add(listener)
    return () => {
      themeSettingChangeListeners.delete(listener)
    }
  }, [])

  return setting
}

export function useEffectiveTheme (): Theme {
  const [theme, setTheme] = useState<Theme>(() => {
    return getEffectiveTheme() ?? getSystemTheme()
  })

  useEffect(() => {
    const listener = () => setTheme(getEffectiveTheme() ?? getSystemTheme())
    effectiveThemeChangeListeners.add(listener)
    return () => {
      effectiveThemeChangeListeners.delete(listener)
    }
  }, [])

  return theme
}

export function useSystemTheme (): Theme {
  const [theme, setTheme] = useState<Theme>(() => getSystemTheme())

  useEffect(() => {
    const listener = () => setTheme(getSystemTheme())
    prefersLightColorScheme.addEventListener('change', listener)
    return () => {
      prefersLightColorScheme.removeEventListener('change', listener)
    }
  }, [])

  return theme
}

export function applyThemeSetting (setting: ThemeSetting): void {
  if (document.documentElement.dataset.themeSetting === setting) {
    return
  }

  document.documentElement.dataset.themeSetting = setting
  dispatchThemeSettingChange()

  updateEffectiveTheme()
}

function getThemeSetting (): ThemeSetting {
  const setting = document.documentElement.dataset.themeSetting
  if (setting === DARK_THEME || setting === LIGHT_THEME) {
    return setting
  }

  return SYSTEM_THEME
}

function getEffectiveTheme (): Theme | undefined {
  if (document.documentElement.classList.contains(DARK_THEME)) {
    return DARK_THEME
  }

  if (document.documentElement.classList.contains(LIGHT_THEME)) {
    return LIGHT_THEME
  }

  return undefined
}

function getSystemTheme (): Theme {
  return prefersLightColorScheme.matches ? LIGHT_THEME : DARK_THEME
}

function updateEffectiveTheme (): void {
  const setting = getThemeSetting()
  const theme = setting === SYSTEM_THEME ? getSystemTheme() : setting

  const previousTheme = getEffectiveTheme()
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

  dispatchEffectiveThemeChange()
}
