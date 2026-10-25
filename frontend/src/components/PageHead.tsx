import { useState } from 'react'
import {
  Banknote,
  Bitcoin,
  Download,
  Gem,
  Landmark,
  Plus,
  TrendingUp,
} from 'lucide-react'

import {
  AddCashOperationModal,
  AddDepositOperationModal,
  AddStockOperationModal,
  AddMetalOperationModal,
  AddBondOperationModal,
} from '@/components/modals'
import { Button } from '@/components/ui/button'
import { PolishEagleIcon } from '@/components/PolishEagleIcon'
import { ImportXtbModal } from '@/components/modals/ImportXtbModal'
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
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false)
  const [metalModalOpen, setMetalModalOpen] = useState(false)
  const [xtbModalOpen, setXtbModalOpen] = useState(false)
  const [bondModalOpen, setBondModalOpen] = useState(false)

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={() => setXtbModalOpen(true)}
          >
            <Download size={14} />
            Importuj z XTB
          </Button>
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
                onSelect={() => setBondModalOpen(true)}
              >
                <PolishEagleIcon size={16} />
                Obligacje skarbowe
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-brand-ink focus:bg-brand focus:text-primary-foreground"
                onSelect={() => setStockModalOpen(true)}
              >
                <TrendingUp size={15} />
                Akcje
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-brand-ink focus:bg-brand focus:text-primary-foreground"
                onSelect={() => setCryptoModalOpen(true)}
              >
                <Bitcoin size={15} />
                Kryptowaluty
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-brand-ink focus:bg-brand focus:text-primary-foreground"
                onSelect={() => setMetalModalOpen(true)}
              >
                <Gem size={15} />
                Kruszce
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {xtbModalOpen && <ImportXtbModal onOpenChange={setXtbModalOpen} />}
      <AddBondOperationModal
        open={bondModalOpen}
        onOpenChange={setBondModalOpen}
      />
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
      <AddMetalOperationModal
        open={metalModalOpen}
        onOpenChange={setMetalModalOpen}
      />
      <AddStockOperationModal
        assetType="crypto"
        open={cryptoModalOpen}
        onOpenChange={setCryptoModalOpen}
      />
    </>
  )
}
