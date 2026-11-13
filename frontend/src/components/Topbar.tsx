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
    <header className="z-40 flex min-h-14 shrink-0 items-center justify-between gap-1 border-b border-border bg-card px-3 sm:gap-2 sm:px-8 md:flex-wrap md:px-6 md:py-3 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-4 xl:px-8 xl:py-3.5">
      <div className="flex shrink-0 items-center gap-2.5 text-base font-semibold tracking-tight text-foreground sm:text-lg">
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

      <div className="flex shrink-0 items-center justify-self-end gap-1 sm:gap-5 md:gap-2">
        <nav
          aria-label="Linki projektu"
          className="flex items-center sm:gap-2 md:hidden"
        >
          <a
            href="https://github.com/Suchy702/simplefund/tree/master"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub — kod projektu (otwiera nową kartę)"
            title="GitHub — kod projektu"
            className="inline-flex h-11 w-8 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8"
          >
            <Github size={16} aria-hidden="true" />
          </a>
        </nav>
        <div className="flex items-center border-l border-border pl-1 sm:gap-2 sm:pl-5 md:gap-2 md:border-l-0 md:pl-0">
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
            className="h-11 border-0 text-ink-2 sm:h-8 md:border md:text-foreground"
            aria-label="Przełącz motyw"
            title={theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
          >
            {theme === 'dark' ? (
              <Sun className="size-4 md:size-[15px]" />
            ) : (
              <Moon className="size-4 md:size-[15px]" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 sm:h-8"
                aria-label="Menu konta"
              >
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
      </div>
    </header>
  )
}
