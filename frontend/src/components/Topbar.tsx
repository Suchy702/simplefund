import { Bell, Github, LogOut, Moon, Shield, Sun } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession, useSignOut } from '@/api/auth'
import { useTheme } from '@/hooks/useTheme'

const getInitials = (email: string): string => email.slice(0, 2).toUpperCase()

export const Topbar = ({
  isAdmin,
  adminActive = false,
  onOpenAdmin,
}: {
  isAdmin: boolean
  adminActive?: boolean
  onOpenAdmin?: () => void
}) => {
  const { theme, toggle } = useTheme()
  const { data: session } = useSession()
  const signOut = useSignOut()

  const initials = session?.user.email ? getInitials(session.user.email) : '?'

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 md:flex-wrap md:px-6 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-4 xl:px-8 xl:py-3.5">
      <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-foreground">
        <span>
          SimpleFund<span className="text-brand">.</span>
        </span>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <Button variant="outline" asChild>
          <a
            href="https://github.com/Suchy702/simplefund/tree/master"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={14} aria-hidden="true" />
            Github
          </a>
        </Button>
        <Button
          variant="outline"
          className="border-[0.5px] border-brand font-normal text-brand hover:bg-brand-soft"
          asChild
        >
          <a
            href="https://buycoffee.to/simplefund"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 bg-current"
              style={{
                mask: 'url(/buycoffee.png) center / contain no-repeat',
                WebkitMask: 'url(/buycoffee.png) center / contain no-repeat',
              }}
            />
            Wesprzyj projekt
          </a>
        </Button>
      </div>

      <div className="flex items-center justify-self-end gap-2">
        {isAdmin && (
          <Button
            className="hidden md:inline-flex"
            variant={adminActive ? 'default' : 'outline'}
            onClick={onOpenAdmin}
            disabled={adminActive}
            aria-current={adminActive ? 'page' : undefined}
          >
            <Shield size={14} />
            Panel admina
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="hidden md:inline-flex"
          aria-label="Powiadomienia"
          title="Powiadomienia"
        >
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
            <Button variant="ghost" size="icon" aria-label="Menu konta">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="md:hidden" asChild>
              <a
                href="https://github.com/Suchy702/simplefund/tree/master"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={14} />
                GitHub
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem className="md:hidden">
              <Bell size={14} />
              Powiadomienia
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem
                className="md:hidden"
                onSelect={onOpenAdmin}
                disabled={adminActive}
              >
                <Shield size={14} />
                Panel admina
              </DropdownMenuItem>
            )}
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
  )
}
