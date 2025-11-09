import { activateTabInPane, findTabByComponentType } from '@editor/layout/layout.js'
import { useCallback } from 'react'
import { useLayout } from '../state/LayoutContext.js'

type ActivateTabOfType = (type: string) => void

export function useActivateTabOfType (): ActivateTabOfType {
  const [, layoutDispatch] = useLayout()

  return useCallback((type: string) => {
    layoutDispatch((layout) => {
      const tab = findTabByComponentType(layout, type)

      if (tab == null) {
        // TODO Create the tab if it doesn't exist
        return layout
      }

      return activateTabInPane(layout, tab.id)
    })
  }, [layoutDispatch])
}
