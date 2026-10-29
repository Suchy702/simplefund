import { useId, useMemo, useRef, useState } from 'react'

import { useElementWidth } from '@/hooks/useElementWidth'
import { fmtMoney } from '@/lib/formatters'
import { formatSeriesDate } from '@/lib/performance'
import type { HistoryPoint } from '@/types/portfolio'

const LEFT = 8
const RIGHT = 92
const TOP = 16
const BOTTOM = 30
type ValueKey = 'value' | 'contribution'

interface PerformanceChartProps {
  series: HistoryPoint[]
  showContribution: boolean
  height?: number
}

export const PerformanceChart = ({
  series,
  showContribution,
  height = 300,
}: PerformanceChartProps) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const areaGradientId = `portfolio-area-${useId().replace(/:/g, '')}`
  const width = useElementWidth(wrapRef, 800)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const lines: {
    key: ValueKey
    label: string
    color: string
  }[] = [
    { key: 'value', label: 'Portfel', color: 'var(--pos)' },
    ...(showContribution
      ? [
          {
            key: 'contribution' as const,
            label: 'Wkład własny',
            color: '#3b82f6',
          },
        ]
      : []),
  ]
  const innerW = Math.max(1, width - LEFT - RIGHT)
  const innerH = height - TOP - BOTTOM
  const computed = useMemo(() => {
    const keys: ValueKey[] = [
      'value',
      ...(showContribution ? ['contribution' as const] : []),
    ]
    let minimum = Infinity
    let maximum = -Infinity
    for (const point of series) {
      for (const key of keys) {
        const value = point[key]
        if (value !== null) {
          minimum = Math.min(minimum, value)
          maximum = Math.max(maximum, value)
        }
      }
    }
    if (!Number.isFinite(minimum)) return null
    const padding = Math.max(
      (maximum - minimum) * 0.08,
      Math.abs(maximum) * 0.02,
      1
    )
    minimum -= padding
    maximum += padding
    const xStep = innerW / Math.max(1, series.length - 1)
    const x = (index: number) => LEFT + index * xStep
    const y = (value: number) =>
      TOP + (innerH * (maximum - value)) / (maximum - minimum)
    const paths = Object.fromEntries(
      keys.map((key) => {
        let path = ''
        let connected = false
        series.forEach((point, index) => {
          const value = point[key]
          if (value === null) {
            connected = false
            return
          }
          // Straight segments preserve supplied values without spline overshoot.
          path += `${connected ? ' L' : ' M'} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`
          connected = true
        })
        return [key, path]
      })
    )
    const areaPaths: string[] = []
    let segment = ''
    let firstX = 0
    let lastX = 0
    const closeArea = () => {
      if (!segment) return
      const baseline = (TOP + innerH).toFixed(2)
      areaPaths.push(
        `${segment} L ${lastX.toFixed(2)} ${baseline} L ${firstX.toFixed(2)} ${baseline} Z`
      )
      segment = ''
    }
    series.forEach((point, index) => {
      if (point.value === null) {
        closeArea()
        return
      }
      const px = x(index)
      if (!segment) firstX = px
      segment += `${segment ? ' L' : 'M'} ${px.toFixed(2)} ${y(point.value).toFixed(2)}`
      lastX = px
    })
    closeArea()
    const ticks = Array.from(
      { length: 5 },
      (_, index) => minimum + ((maximum - minimum) * index) / 4
    )
    return { x, y, xStep, paths, areaPaths, ticks }
  }, [series, showContribution, innerW, innerH])

  const hoverIndex = hoverDate
    ? series.findIndex((point) => point.date === hoverDate)
    : -1
  const hovered = hoverIndex >= 0 ? series[hoverIndex] : null
  if (!computed || series.length === 0) {
    return (
      <div
        ref={wrapRef}
        style={{ height: Math.min(height, 96) }}
        className="flex items-center justify-center text-ink-3"
      >
        Brak wyceny w tym okresie.
      </div>
    )
  }
  const labelCount = Math.min(5, series.length)
  return (
    <div ref={wrapRef}>
      <div
        className="relative w-full"
        style={{ height }}
        onMouseMove={(event) => {
          const position =
            event.clientX - event.currentTarget.getBoundingClientRect().left
          const index = Math.max(
            0,
            Math.min(
              series.length - 1,
              Math.round((position - LEFT) / computed.xStep)
            )
          )
          setHoverDate(series[index].date)
        }}
        onMouseLeave={() => setHoverDate(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full"
          style={{ height }}
          role="img"
          aria-label="Historia wartości portfela w PLN"
        >
          <defs>
            <linearGradient
              id={areaGradientId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={TOP}
              x2="0"
              y2={TOP + innerH}
            >
              <stop offset="0%" stopColor="var(--pos)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--pos)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {computed.ticks.map((tick, index) => (
            <g key={index}>
              <line
                x1={LEFT}
                x2={LEFT + innerW}
                y1={computed.y(tick)}
                y2={computed.y(tick)}
                stroke="var(--border)"
                opacity="0.5"
              />
              <text
                x={width - 4}
                y={computed.y(tick) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--ink-3)"
              >
                {tick.toLocaleString('pl-PL', { maximumFractionDigits: 0 })}
              </text>
            </g>
          ))}
          <path
            d={computed.areaPaths.join(' ')}
            fill={`url(#${areaGradientId})`}
            pointerEvents="none"
          />
          {lines.map((line) => (
            <g key={line.key}>
              <path
                d={computed.paths[line.key]}
                fill="none"
                stroke={line.color}
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {series.map((point, index) =>
                point[line.key] !== null &&
                (index === 0 || series[index - 1][line.key] === null) &&
                (index === series.length - 1 ||
                  series[index + 1][line.key] === null) ? (
                  <circle
                    key={point.date}
                    cx={computed.x(index)}
                    cy={computed.y(point[line.key]!)}
                    r="2.5"
                    fill={line.color}
                  />
                ) : null
              )}
            </g>
          ))}
          {hovered && (
            <line
              x1={computed.x(hoverIndex)}
              x2={computed.x(hoverIndex)}
              y1={TOP}
              y2={TOP + innerH}
              stroke="var(--ink-3)"
              strokeDasharray="3 3"
            />
          )}
          {Array.from({ length: labelCount }, (_, index) => {
            const pointIndex = Math.round(
              (index * (series.length - 1)) / Math.max(1, labelCount - 1)
            )
            return (
              <text
                key={index}
                x={computed.x(pointIndex)}
                y={height - 6}
                textAnchor={
                  index === 0
                    ? 'start'
                    : index === labelCount - 1
                      ? 'end'
                      : 'middle'
                }
                fontSize="11"
                fill="var(--ink-3)"
              >
                {formatSeriesDate(series[pointIndex].date)}
              </text>
            )
          })}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 max-w-[280px] rounded-sm border border-border bg-card px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.max(
                0,
                Math.min(width - 260, computed.x(hoverIndex) - 100)
              ),
            }}
          >
            <p className="mb-1 text-ink-3">{formatSeriesDate(hovered.date)}</p>
            {lines.map((line) => (
              <p key={line.key} className="flex justify-between gap-3">
                <span>{line.label}</span>
                <span className="font-mono tabular">
                  {hovered[line.key] === null
                    ? 'Brak wyceny'
                    : fmtMoney(hovered[line.key]!, 'PLN')}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
