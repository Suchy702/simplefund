import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PageHeadProps {
  asOfDate: string;
  syncedMinutesAgo: number;
}

export function PageHead({ asOfDate, syncedMinutesAgo }: PageHeadProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="m-0 mb-1 text-2xl font-semibold tracking-tighter2 text-foreground">
          Twój portfel
        </h1>
        <div className="text-13 text-ink-3">
          Stan na dziś, {asOfDate} · ostatnia synchronizacja {syncedMinutesAgo} min temu
        </div>
      </div>
      <Button variant="default" size="lg">
        <Plus size={14} />
        Nowa operacja
      </Button>
    </div>
  );
}
