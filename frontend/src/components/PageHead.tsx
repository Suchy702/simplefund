import { useState } from 'react'
import { Banknote, Landmark, Plus, TrendingUp } from 'lucide-react'

import {
  AddCashOperationModal,
  AddDepositOperationModal,
  AddStockOperationModal,
} from '@/components/modals'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface PageHeadProps {
  asOfDate: string
  syncedMinutesAgo: number | null
}

export const PageHead = ({ asOfDate, syncedMinutesAgo }: PageHeadProps) => {
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [stockModalOpen, setStockModalOpen] = useState(false)

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-semibold tracking-tighter2 text-foreground">
            Twój portfel
          </h1>
          <div className="text-13 text-ink-3">
            {asOfDate ? `Stan na ${asOfDate}` : 'Stan portfela'}
            {syncedMinutesAgo !== null &&
              ` · ostatnia synchronizacja ${syncedMinutesAgo} min temu`}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="brand" size="lg">
              <Plus size={14} />
              Nowa operacja
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="dropdown-slide w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden border-brand bg-brand-soft p-1"
          >
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-brand-ink focus:bg-brand focus:text-primary-foreground"
              onSelect={() => setCashModalOpen(true)}
            >
              <Banknote size={15} />
              Gotówka
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-brand-ink focus:bg-brand focus:text-primary-foreground"
              onSelect={() => setDepositModalOpen(true)}
            >
              <Landmark size={15} />
              Lokata
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-brand-ink focus:bg-brand focus:text-primary-foreground"
              onSelect={() => setStockModalOpen(true)}
            >
              <TrendingUp size={15} />
              Akcje
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddCashOperationModal
        open={cashModalOpen}
        onOpenChange={setCashModalOpen}
      />
      <AddDepositOperationModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
      />
      <AddStockOperationModal
        open={stockModalOpen}
        onOpenChange={setStockModalOpen}
      />
    </>
  )
}
