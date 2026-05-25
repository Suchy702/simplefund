import { useMemo, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioSeries } from '@/api/portfolio'
import { useElementWidth } from '@/hooks/useElementWidth'
import { fmtMoney } from '@/lib/formatters'
import type { RangeKey } from '@/types/portfolio'

const PAD_LEFT = 8
const PAD_RIGHT = 56
const PAD_TOP = 12
const PAD_BOTTOM = 30

const RANGE_X_LABELS: Record<RangeKey, string[]> = {
  '1M': ['28d', '21d', '14d', '7d', 'dziś'],
  '3M': ['paź', 'lis', 'gru', 'sty', 'lut'],
  '6M': ['lis', 'gru', 'sty', 'lut', 'mar'],
  '1R': ['kwi', 'cze', 'sie', 'paź', 'gru', 'lut'],
  MAX: ['2021', '2022', '2023', '2024', '2026'],
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const t = 0.18
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = p1.y + (p2.y - p0.y) * t
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

interface PerformanceChartProps {
  range: RangeKey
  height?: number
}

export function PerformanceChart({
  range,
  height = 300,
}: PerformanceChartProps) {
  const { data, isLoading } = usePortfolioSeries(range)
  const wrapRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(wrapRef, 800)
  const [hover, setHover] = useState<{
    idx: number
    px: number
    py: number
    val: number
  } | null>(null)

  const innerW = Math.max(100, width - PAD_LEFT - PAD_RIGHT)
  const innerH = height - PAD_TOP - PAD_BOTTOM

  const computed = useMemo(() => {
    if (!data || data.length === 0) return null
    const dataMin = Math.min(...data)
    const dataMax = Math.max(...data)
    const step = 20000
    const min = Math.floor((dataMin * 0.96) / step) * step
    const max = Math.ceil((dataMax * 1.04) / step) * step
    const xStep = innerW / (data.length - 1)
    const x = (i: number) => PAD_LEFT + i * xStep
    const y = (v: number) => PAD_TOP + innerH * (1 - (v - min) / (max - min))
    const points = data.map((v, i) => ({ x: x(i), y: y(v) }))
    const linePath = smoothPath(points)
    const areaPath = `${linePath} L ${x(data.length - 1).toFixed(2)} ${(PAD_TOP + innerH).toFixed(2)} L ${PAD_LEFT.toFixed(2)} ${(PAD_TOP + innerH).toFixed(2)} Z`
    const gridY: number[] = []
    for (let v = min; v <= max + 0.001; v += step) gridY.push(v)
    return { x, y, xStep, linePath, areaPath, gridY, min, max }
  }, [data, innerW, innerH])

  const xLabels = RANGE_X_LABELS[range]
  const tooltipDate = useMemo(() => {
    if (!hover || !data) return ''
    const ratio = hover.idx / (data.length - 1)
    switch (range) {
      case '1M':
        return `${30 - Math.round(ratio * 30)}d temu`
      case '3M':
        return `${Math.round((1 - ratio) * 90)}d temu`
      case '6M':
        return `${Math.round((1 - ratio) * 180)}d temu`
      case '1R':
        return `${Math.round((1 - ratio) * 52)}t temu`
      case 'MAX':
        return `${2021 + Math.round(ratio * 5)}`
    }
  }, [hover, range, data])

  if (isLoading || !data || !computed) {
    return (
      <div ref={wrapRef} style={{ height }} className="w-full">
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  const trend = data[data.length - 1] - data[0]
  const lineColor = trend >= 0 ? 'var(--pos)' : 'var(--neg)'
  const gradId = `areaGrad-${range}`

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!wrapRef.current || !data || !computed) return
    const rect = wrapRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const idx = Math.max(
      0,
      Math.min(data.length - 1, Math.round((px - PAD_LEFT) / computed.xStep))
    )
    setHover({
      idx,
      px: computed.x(idx),
      py: computed.y(data[idx]),
      val: data[idx],
    })
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      className="relative w-full"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {computed.gridY.map((g, i) => (
          <line
            key={`yg-${i}`}
            x1={PAD_LEFT}
            x2={PAD_LEFT + innerW}
            y1={computed.y(g)}
            y2={computed.y(g)}
            stroke="var(--border)"
            strokeWidth="1"
            opacity="0.5"
          />
        ))}
        {computed.gridY.map((g, i) => (
          <text
            key={`yl-${i}`}
            x={width - 8}
            y={computed.y(g) + 3}
            textAnchor="end"
            fontSize="11"
            fill="var(--ink-3)"
          >
            {(g / 1000).toFixed(0)}k
          </text>
        ))}

        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT + innerW}
          y1={PAD_TOP + innerH}
          y2={PAD_TOP + innerH}
          stroke="var(--border)"
          strokeWidth="1"
        />

        <path d={computed.areaPath} fill={`url(#${gradId})`} />
        <path
          d={computed.linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover && (
          <>
            <line
              x1={hover.px}
              x2={hover.px}
              y1={PAD_TOP}
              y2={PAD_TOP + innerH}
              stroke="var(--ink-3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hover.px}
              cy={hover.py}
              r="4.5"
              fill={lineColor}
              stroke="var(--bg-elevated)"
              strokeWidth="2"
            />
          </>
        )}

        {xLabels.map((lbl, i) => (
          <text
            key={`xl-${i}`}
            x={PAD_LEFT + (i / (xLabels.length - 1)) * innerW}
            y={height - 8}
            textAnchor={
              i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'
            }
            fontSize="11"
            fill="var(--ink-3)"
          >
            {lbl}
          </text>
        ))}
      </svg>

      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-[110%] rounded-sm bg-foreground px-2.5 py-2 text-xs text-card shadow-md transition-opacity"
        style={{
          left: hover ? hover.px : 0,
          top: hover ? hover.py : 0,
          opacity: hover ? 1 : 0,
        }}
      >
        <div className="mb-0.5 text-tiny text-ink-4">{tooltipDate}</div>
        <div className="font-mono tabular font-semibold">
          {hover ? fmtMoney(hover.val, 'PLN') : ''}
        </div>
      </div>
    </div>
  )
}
