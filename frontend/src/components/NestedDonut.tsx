import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { AllocationSegment } from '@/types/portfolio'

interface NestedDonutProps {
  outer: AllocationSegment[]
  inner: AllocationSegment[]
  size?: number
  outerThickness?: number
  innerThickness?: number
  gap?: number
}

export const NestedDonut = ({
  outer,
  inner,
  size = 220,
  outerThickness = 22,
  innerThickness = 16,
  gap = 4,
}: NestedDonutProps) => {
  const tooltipId = useId()
  const [activeSegment, setActiveSegment] = useState<AllocationSegment | null>(
    null
  )
  const [tooltipPosition, setTooltipPosition] = useState({
    x: size / 2,
    y: size / 2,
  })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    if (!activeSegment || !tooltipRef.current) return
    const { width, height } = tooltipRef.current.getBoundingClientRect()
    const above = tooltipPosition.y - height - 12
    setPlacement({
      left: Math.max(
        8,
        Math.min(tooltipPosition.x - width / 2, window.innerWidth - width - 8)
      ),
      top: Math.max(
        8,
        Math.min(
          above >= 8 ? above : tooltipPosition.y + 12,
          window.innerHeight - height - 8
        )
      ),
    })
  }, [activeSegment, tooltipPosition])

  useEffect(() => {
    const hide = () => setActiveSegment(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])
  const rOuter = (size - outerThickness) / 2
  const rInner = (size - 2 * outerThickness - 2 * gap - innerThickness) / 2

  const renderRing = (
    segments: AllocationSegment[],
    radius: number,
    thickness: number,
    ring: string
  ) => {
    let offset = -Math.PI / 2
    return segments.map((segment, index) => {
      const start = offset
      const sweep = (segment.pct / 100) * 2 * Math.PI
      offset += sweep
      if (sweep <= 0) return null

      const point = (angle: number) =>
        `${size / 2 + radius * Math.cos(angle)} ${size / 2 + radius * Math.sin(angle)}`
      // Two arcs also draw a complete ring when a segment occupies 100%.
      const path = `M ${point(start)} A ${radius} ${radius} 0 0 1 ${point(start + sweep / 2)} A ${radius} ${radius} 0 0 1 ${point(offset)}`

      return (
        <path
          key={`${ring}-${index}`}
          d={path}
          fill="none"
          stroke={segment.color}
          strokeWidth={thickness}
          pointerEvents="stroke"
          tabIndex={0}
          role="img"
          aria-label={`${segment.name}: ${segment.pct.toFixed(1)}%`}
          aria-describedby={activeSegment === segment ? tooltipId : undefined}
          className="cursor-default outline-none focus:opacity-75 hover:opacity-75"
          onPointerEnter={(event) => {
            setTooltipPosition({ x: event.clientX, y: event.clientY })
            setActiveSegment(segment)
          }}
          onPointerMove={(event) => {
            setTooltipPosition({
              x: event.clientX,
              y: event.clientY,
            })
          }}
          onPointerLeave={() => setActiveSegment(null)}
          onFocus={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            setTooltipPosition({
              x: bounds.left + bounds.width / 2,
              y: bounds.top,
            })
            setActiveSegment(segment)
          }}
          onBlur={() => setActiveSegment(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setActiveSegment(null)
          }}
        />
      )
    })
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
      >
        {renderRing(outer, rOuter, outerThickness, 'outer')}
        {renderRing(inner, rInner, innerThickness, 'inner')}
      </svg>
      {activeSegment &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-max max-w-[min(320px,calc(100vw-16px))] rounded-sm bg-foreground px-2.5 py-2 text-center text-xs text-card shadow-md"
            style={placement}
          >
            <div className="break-words font-medium">{activeSegment.name}</div>
            <div className="mt-0.5 font-mono tabular">
              {activeSegment.pct.toFixed(1)}%
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
