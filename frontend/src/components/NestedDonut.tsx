import { useId, useState } from 'react'

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
          onPointerEnter={() => setActiveSegment(segment)}
          onPointerMove={(event) => {
            const bounds =
              event.currentTarget.ownerSVGElement!.getBoundingClientRect()
            setTooltipPosition({
              x: event.clientX - bounds.left,
              y: event.clientY - bounds.top,
            })
          }}
          onPointerLeave={() => setActiveSegment(null)}
          onFocus={() => {
            setTooltipPosition({ x: size / 2, y: size / 2 })
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
      {activeSegment && (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max max-w-full -translate-x-1/2 -translate-y-full rounded-sm bg-foreground px-2.5 py-2 text-center text-xs text-card shadow-md"
          style={{ left: tooltipPosition.x, top: tooltipPosition.y - 12 }}
        >
          <div className="break-words font-medium">{activeSegment.name}</div>
          <div className="mt-0.5 font-mono tabular">
            {activeSegment.pct.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  )
}
