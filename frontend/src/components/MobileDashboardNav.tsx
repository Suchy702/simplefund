import { Fragment } from 'react'
import { BarChart3, History, TrendingUp, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export const sections = [
  { id: 'portfolio-stats', label: 'Statystyki', icon: BarChart3 },
  { id: 'portfolio-holdings', label: 'Portfel', icon: Wallet },
  { id: 'portfolio-performance', label: 'Wyniki', icon: TrendingUp },
  { id: 'portfolio-operations', label: 'Operacje', icon: History },
] as const

export type SectionId = (typeof sections)[number]['id']

export const MobileDashboardNav = ({
  active,
  onSelect,
}: {
  active: SectionId
  onSelect: (id: SectionId) => void
}) => {
  return (
    <nav
      aria-label="Nawigacja portfela"
      className="z-20 grid shrink-0 grid-cols-5 gap-1 border-t border-border bg-card px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] md:hidden"
    >
      {sections.map(({ id, label, icon: Icon }, index) => (
        <Fragment key={id}>
          {index === 2 && (
            <a
              href="https://buycoffee.to/simplefund"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Wesprzyj projekt na BuyCoffee (otwiera nową kartę)"
              className="-mt-4 flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1 rounded-sm text-brand-ink transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-card bg-brand text-primary-foreground shadow-md">
                <span
                  aria-hidden="true"
                  className="h-6 w-6 bg-current"
                  style={{
                    mask: 'url(/buycoffee.png) center / contain no-repeat',
                    WebkitMask:
                      'url(/buycoffee.png) center / contain no-repeat',
                  }}
                />
              </span>
              <span className="text-[10px] font-semibold leading-tight">
                Wesprzyj
              </span>
            </a>
          )}
          <button
            type="button"
            onClick={() => onSelect(id)}
            aria-current={active === id ? 'page' : undefined}
            aria-controls={id}
            className={cn(
              'flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-sm px-1 py-1.5 text-ink-3 transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              active === id && 'text-brand-ink hover:text-brand-ink'
            )}
          >
            <Icon
              size={21}
              strokeWidth={active === id ? 2.25 : 1.75}
              aria-hidden="true"
            />
            <span
              className={cn(
                'text-[10px] leading-tight',
                active === id && 'font-semibold'
              )}
            >
              {label}
            </span>
          </button>
        </Fragment>
      ))}
    </nav>
  )
}
