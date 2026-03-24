import { useCallback } from 'react'
import { activateTabInPane, createTab, findTabByComponentType } from '../layout/algorithms.js'
import { useLayout, type LayoutDispatch } from '../layout/components/LayoutContext.js'

type ActivateTabOfType = (type: string) => void

export function useActivateTabOfType (): ActivateTabOfType {
  const [, layoutDispatch] = useLayout()

  return useCallback((type: string) => activateTabOfType(layoutDispatch, type), [layoutDispatch])
}

export function activateTabOfType (layoutDispatch: LayoutDispatch, type: string): void {
  layoutDispatch((layout) => {
    const tab = findTabByComponentType(layout, type)

    if (tab == null) {
      return createTab(layout, { type })
    }

    return activateTabInPane(layout, tab.id)
  })
}
