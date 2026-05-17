import { Bell, Download, Moon, Sun } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export function Topbar() {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-8 py-3.5 shrink-0">
      <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
        <span className="grid h-5.5 w-5.5 place-items-center rounded-sm bg-brand text-13 font-bold text-primary-foreground">
          S
        </span>
        <span>SimpleFund</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="default">
          <Download size={14} />
          Importuj z XTB
        </Button>
        <Button variant="outline" size="icon" aria-label="Powiadomienia" title="Powiadomienia">
          <Bell size={15} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggle}
          aria-label="Przełącz motyw"
          title={theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
        <Avatar>
          <AvatarFallback>JK</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
