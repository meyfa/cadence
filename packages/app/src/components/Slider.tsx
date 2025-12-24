import { Adjust } from '@mui/icons-material'
import clsx from 'clsx'
import React, { FunctionComponent, PropsWithChildren, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useGlobalKeydown, useGlobalMouseUp } from '../hooks/input.js'
import './Slider.css'

export const Slider: FunctionComponent<PropsWithChildren<{
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  label?: string
  orientation?: 'horizontal' | 'vertical'
  step?: number
  icon?: ReactNode
  collapsible?: boolean
}>> = ({ children, min, max, value, onChange, label, orientation, step, icon, collapsible }) => {
  const containerRef = useRef<HTMLLabelElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)

  const vertical = orientation === 'vertical'
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(collapsible === true ? true : false)
  }, [collapsible])

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

  const onSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.valueAsNumber)
  }, [onChange])

  const onSliderBlur = useCallback(() => {
    if (collapsible === true) {
      setCollapsed(true)
    }
  }, [collapsible])

  useGlobalMouseUp((event) => {
    // do not collapse if clicking on the slider itself
    if (event.target instanceof Node && containerRef.current?.contains(event.target)) {
      return
    }

    if (collapsible === true) {
      setCollapsed(true)
    }
  }, [collapsible])

  useGlobalKeydown((event) => {
    if (event.key === 'Escape' && collapsible === true) {
      setCollapsed(true)
    }
  }, [collapsible, collapsed])

  if (collapsible === true && collapsed) {
    return (
      <button
        type='button'
        onClick={onClickExpand}
        className={clsx(
          'leading-none rounded flex items-center justify-center gap-2 select-none px-2 py-1',
          'bg-surface-200 border border-frame-200 text-content-300',
          'outline-none cursor-pointer hocus:bg-surface-300 hocus:border-frame-300',
          vertical ? 'w-12 h-10 flex-col' : 'w-full h-10 flex-row'
        )}
        title={label}
      >
        {icon ?? <Adjust />}
      </button>
    )
  }

  return (
    <label
      ref={containerRef}
      className={clsx(
        'leading-none rounded flex items-center justify-center gap-2 bg-surface-200 border border-frame-200 text-content-300 select-none px-2 py-1',
        collapsible ? 'bg-surface-300 border border-frame-300 text-content-300' : 'bg-surface-200 border border-frame-200 text-content-300',
        vertical ? 'w-12 h-full min-h-56 flex-col' : 'w-full h-10 min-w-56 flex-row'
      )}
      title={label}
    >
      <div className={clsx('flex items-center justify-center', vertical ? 'h-[calc(2rem-2px)] flex-col' : 'w-6 flex-row')}>
        {icon ?? <Adjust />}
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
            className={clsx(
              'flex-1 min-w-0 min-h-0 cadence-slider',
              vertical ? 'cadence-slider-vertical' : 'cadence-slider-horizontal'
            )}
            onChange={onSliderChange}
            onBlur={onSliderBlur}
          />

          {children}
        </>
      )}
    </label>
  )
}
