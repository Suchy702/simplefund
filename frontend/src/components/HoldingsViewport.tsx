import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const VISIBLE_HOLDINGS = 6

export const HoldingsViewport = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>()

  useLayoutEffect(() => {
    const table = viewportRef.current?.querySelector('table')
    if (!table) return
    const rows = Array.from(
      table.querySelectorAll<HTMLElement>('[data-holding-row]')
    )
    if (rows.length <= VISIBLE_HOLDINGS) {
      setMaxHeight(undefined)
      return
    }
    const visibleRows = rows.slice(0, VISIBLE_HOLDINGS)
    const measure = () => {
      if (!table.getBoundingClientRect().width) return
      const viewport = viewportRef.current!
      const scrollbarHeight = viewport.offsetHeight - viewport.clientHeight
      setMaxHeight(
        Math.ceil(
          visibleRows[VISIBLE_HOLDINGS - 1].getBoundingClientRect().bottom -
            table.getBoundingClientRect().top +
            scrollbarHeight
        )
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(table)
    visibleRows.forEach((row) => observer.observe(row))
    return () => observer.disconnect()
  }, [children])

  return (
    <div
      ref={viewportRef}
      style={{ maxHeight }}
      className={cn(
        'relative w-full overflow-auto overscroll-contain [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className
      )}
      tabIndex={maxHeight === undefined ? undefined : 0}
      role={maxHeight === undefined ? undefined : 'region'}
      aria-label={
        maxHeight === undefined
          ? undefined
          : 'Lista aktywów — przewiń, aby zobaczyć pozostałe'
      }
    >
      {children}
    </div>
  )
}
