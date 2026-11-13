import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const HoldingsViewport = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  return (
    <div
      className={cn(
        'relative w-full overflow-auto overscroll-contain [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className
      )}
      tabIndex={0}
      role="region"
      aria-label="Lista aktywów — przewiń, aby zobaczyć pozostałe"
    >
      {children}
    </div>
  )
}
