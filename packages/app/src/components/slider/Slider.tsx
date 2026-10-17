import { useGlobalEscapePress, useGlobalMouseUp } from '@meyfa/cadence-editor'
import { Adjust } from '@mui/icons-material'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import React, { FunctionComponent, PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react'
import './Slider.css'

type Orientation = 'horizontal' | 'vertical'

export const Slider: FunctionComponent<PropsWithChildren<{
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  step?: number
  orientation?: Orientation
  collapsible?: boolean
  label?: string
  icon?: ReactNode
}>> = ({
  children,
  min,
  max,
  value,
  onChange,
  step,
  orientation = 'horizontal',
  collapsible,
  label,
  icon
}) => {
  const containerRef = useRef<HTMLLabelElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const interactingRef = useRef(false)

  const onSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.valueAsNumber)
  }, [onChange])

  const [collapsed, setCollapsed] = useState(false)

  const collapse = useCallback(() => {
    setCollapsed(collapsible === true ? true : false)
  }, [collapsible])

  useEffect(() => collapse(), [collapse])

  const onClickExpand = useCallback((event: React.MouseEvent) => {
    if (collapsible === true) {
      event.preventDefault()
      event.stopPropagation()
      setCollapsed(false)
      requestAnimationFrame(() => {
        sliderRef.current?.focus()
      })
    }
  }, [collapsible])

  const onSliderBlur = useCallback(() => {
    // Safari may emit a blur event while interacting with the native range control.
    if (!interactingRef.current) {
      collapse()
    }
  }, [collapse])

  const onSliderMouseDown = useCallback(() => {
    interactingRef.current = true
  }, [])

  useGlobalMouseUp((event) => {
    if (interactingRef.current) {
      interactingRef.current = false
      sliderRef.current?.focus()
    }

    // only collapse if clicking outside the slider itself
    const container = containerRef.current
    if (container == null || !event.composedPath().includes(container)) {
      collapse()
    }
  })

  useGlobalEscapePress(() => {
    collapse()
  })

  const iconNode = (icon ?? <Adjust />)

  if (collapsible === true && collapsed) {
    return (
      <button type='button' title={label} onClick={onClickExpand} className={styles.button(orientation)}>
        {iconNode}
      </button>
    )
  }

  return (
    <label ref={containerRef} title={label} className={styles.container(orientation, collapsible)}>
      <div className={styles.icon(orientation)}>
        {iconNode}
      </div>

      {!collapsed && (
        <>
          <input
            ref={sliderRef}
            type='range'
            min={min}
            max={max}
            value={value}
            step={step}
            className={styles.slider(orientation)}
            onChange={onSliderChange}
            onMouseDown={onSliderMouseDown}
            onBlur={onSliderBlur}
          />

          {children}
        </>
      )}
    </label>
  )
}

const styles = {
  button: (orientation: Orientation) => clsx(
    'leading-none rounded flex items-center justify-center gap-2 px-2 py-1 select-none outline-none cursor-pointer',
    'bg-surface-200 border border-frame-200 text-content-300',
    'hocus:bg-surface-300 hocus:border-frame-300',
    {
      'w-11 h-8 flex-col': orientation === 'vertical',
      'w-full h-8 flex-row': orientation === 'horizontal'
    }
  ),

  container: (orientation: Orientation, collapsible = false) => clsx(
    'leading-none rounded flex items-center justify-center gap-2 px-2 py-1 select-none',
    {
      'bg-surface-300 border border-frame-300 text-content-300': collapsible,
      'bg-surface-200 border border-frame-200 text-content-300': !collapsible
    },
    {
      'w-11 h-full min-h-56 flex-col': orientation === 'vertical',
      'w-full h-8 min-w-56 flex-row': orientation === 'horizontal'
    }
  ),

  icon: (orientation: Orientation) => clsx(
    'flex items-center justify-center',
    {
      'h-[calc(1.5rem-2px)] flex-col': orientation === 'vertical',
      'w-6 flex-row': orientation === 'horizontal'
    }
  ),

  slider: (orientation: Orientation) => clsx(
    'flex-1 min-w-0 min-h-0 cadence-slider',
    {
      'cadence-slider-vertical': orientation === 'vertical',
      'cadence-slider-horizontal': orientation === 'horizontal'
    }
  )
}
