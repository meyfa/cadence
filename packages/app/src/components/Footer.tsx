import { type FunctionComponent, type PropsWithChildren } from 'react'
import { useActivateTabOfType } from '../hooks/layout.js'
import { useProblems } from '../hooks/problems.js'
import { TabTypes } from '../panes/render-tab.js'
import { useEditor } from '../state/EditorContext.js'
import { pluralize } from '../utilities/strings.js'

export const Footer: FunctionComponent = () => {
  const activateTab = useActivateTabOfType()

  const problems = useProblems()

  const [editor] = useEditor()
  const editorLocation = editor.caret

  return (
    <footer className='flex h-6 px-2 gap-2 items-center text-sm bg-surface-200 text-content-200 border-t border-t-frame-100 select-none'>
      <FooterButton onClick={() => activateTab(TabTypes.Problems)}>
        {problems.length === 0 ? 'No errors' : pluralize(problems.length, 'error')}
      </FooterButton>

      <div className='flex-1' />

      {editorLocation != null && (
        <FooterButton onClick={() => activateTab(TabTypes.Editor)}>
          Ln {editorLocation.line}, Col {editorLocation.column}
        </FooterButton>
      )}
    </footer>
  )
}

const FooterButton: FunctionComponent<PropsWithChildren<{
  onClick?: () => void
}>> = ({ onClick, children }) => {
  return (
    <button
      type='button'
      className='px-2 h-full enabled:cursor-pointer enabled:hocus:bg-surface-300 enabled:hocus:text-content-300'
      onClick={onClick}
      disabled={onClick == null}
    >
      {children}
    </button>
  )
}
