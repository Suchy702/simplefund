import { useLayoutEffect, useRef, useState } from 'react'

import { AllocationCard } from '@/components/AllocationCard'
import { Hero } from '@/components/Hero'
import { HoldingsTable } from '@/components/HoldingsTable'
import {
  MobileDashboardNav,
  sections,
  type SectionId,
} from '@/components/MobileDashboardNav'
import { OperationsTable } from '@/components/OperationsTable'
import { PageHead } from '@/components/PageHead'
import { PerformanceCard } from '@/components/PerformanceCard'
import { PerformanceStats } from '@/components/PerformanceStats'
import { Topbar } from '@/components/Topbar'
import { usePortfolioKpi } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { formatSeriesDate } from '@/lib/performance'
import type { RangeKey } from '@/types/portfolio'

const DashboardPage = ({
  isAdmin,
  onOpenAdmin,
}: {
  isAdmin: boolean
  onOpenAdmin: () => void
}) => {
  const scrollRef = useRef<HTMLElement>(null)
  const [activeSection, setActiveSection] =
    useState<SectionId>('portfolio-stats')
  const [range, setRange] = useState<RangeKey>('1R')
  const { data: kpi } = usePortfolioKpi()
  const isTableSection =
    activeSection === 'portfolio-holdings' ||
    activeSection === 'portfolio-operations'

  useLayoutEffect(() => {
    if (window.matchMedia('(max-width: 767.98px)').matches) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [activeSection])

  const sectionClass = (id: SectionId) =>
    cn('min-w-0 md:block', activeSection !== id && 'hidden')

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <Topbar isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />

      <main
        ref={scrollRef}
        className={cn(
          'mobile-scrollbar-hidden min-h-0 flex-1 overscroll-y-none px-4 pt-5 sm:px-6 sm:pt-6 md:overscroll-y-auto lg:px-8 lg:pt-8',
          isTableSection
            ? 'overflow-hidden pb-0 md:overflow-y-auto md:pb-12'
            : 'overflow-y-auto pb-0 md:pb-12'
        )}
      >
        <div
          className={cn(
            'mx-auto w-full max-w-[1280px] md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-x-4',
            isTableSection && 'flex h-full min-h-0 flex-col md:h-auto'
          )}
        >
          <div className="shrink-0 md:col-span-2">
            <PageHead
              mobileTitle={
                sections.find(({ id }) => id === activeSection)?.label
              }
              asOfDate={kpi?.asOfDate ? formatSeriesDate(kpi.asOfDate) : ''}
              syncedMinutesAgo={kpi?.syncedMinutesAgo ?? null}
              mobileActionsVisible={activeSection === 'portfolio-operations'}
            />
          </div>

          <section
            id="portfolio-stats"
            aria-label="Statystyki portfela"
            className={cn(sectionClass('portfolio-stats'), 'md:contents')}
          >
            <div className="md:col-span-2">
              <Hero />
            </div>
            <div className="mb-4 md:col-start-2 md:row-start-3">
              <AllocationCard />
            </div>
          </section>

          <section
            id="portfolio-holdings"
            aria-label="Aktywa portfela"
            className={cn(
              sectionClass('portfolio-holdings'),
              'min-h-0 flex-1 md:mb-4 md:col-start-1 md:row-start-3'
            )}
          >
            <HoldingsTable />
          </section>

          <section
            id="portfolio-performance"
            aria-label="Wyniki historyczne"
            className={cn(
              sectionClass('portfolio-performance'),
              'md:col-span-2'
            )}
          >
            <PerformanceCard range={range} onRangeChange={setRange} />
            <PerformanceStats range={range} />
          </section>

          <section
            id="portfolio-operations"
            aria-label="Historia operacji"
            className={cn(
              sectionClass('portfolio-operations'),
              'min-h-0 flex-1 md:col-span-2'
            )}
          >
            <OperationsTable />
          </section>
        </div>
      </main>
      <MobileDashboardNav active={activeSection} onSelect={setActiveSection} />
    </div>
  )
}

export default DashboardPage
