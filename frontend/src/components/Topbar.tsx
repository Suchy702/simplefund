import { Bell, Download, LogOut, Moon, Sun } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession, useSignOut } from '@/api/auth';
import { useTheme } from '@/hooks/useTheme';

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const signOut = useSignOut();

  const initials = session?.user.email ? getInitials(session.user.email) : '?';

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="gap-2 text-red-500 focus:text-red-500"
            >
              <LogOut size={14} />
              Wyloguj się
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
