import type { MouseEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Banknote,
  Gem,
  Github,
  Landmark,
  Moon,
  Sun,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeltaPill } from '@/components/DeltaPill'
import { TickerBadge } from '@/components/TickerBadge'
import { fmtMoney, fmtNumber } from '@/lib/formatters'
import { landingHoldings } from '@/mocks/landing'
import { CryptoIcon } from '@/components/CryptoIcon'
import { LandingPortfolioPreview } from '@/components/LandingPortfolioPreview'
import {
  LandingXtbPreview,
  LandingStatisticsPreview,
  LandingHistoryPreview,
} from '@/components/LandingFeaturePreviews'
import { useTheme } from '@/hooks/useTheme'
import { useLandingMotion } from '@/hooks/useLandingMotion'
import '@/styles/landing-motion.css'

interface LandingPageProps {
  onGoToLogin: () => void
  onGoToRegister: () => void
}

const assetTypes = [
  { icon: TrendingUp, name: 'Akcje i ETF-y' },
  { icon: Landmark, name: 'Obligacje skarbowe' },
  { icon: Wallet, name: 'Lokaty' },
  { icon: Gem, name: 'Kruszce' },
  { icon: CryptoIcon, name: 'Kryptowaluty' },
  { icon: Banknote, name: 'Gotówka' },
]

const LandingPage = ({ onGoToLogin, onGoToRegister }: LandingPageProps) => {
  const { theme, toggle } = useTheme()
  const motionRef = useLandingMotion()

  const scrollToFeatures = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = document.getElementById('instrumenty')
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
    target.focus({ preventScroll: true })
  }

  return (
    <div
      ref={motionRef}
      className="landing-page min-h-full bg-background text-foreground"
    >
      <div className="landing-scroll-progress" aria-hidden="true" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:p-4"
      >
        Przejdź do treści
      </a>
      <header data-reveal className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-14 max-w-[1200px] items-center justify-between gap-2 px-4 sm:px-8">
          <a
            href="#"
            aria-label="SimpleFund — strona główna"
            className="shrink-0 text-lg font-semibold tracking-tight"
          >
            SimpleFund<span className="text-brand">.</span>
          </a>
          <div className="flex items-center gap-1 sm:gap-5">
            <nav
              aria-label="Linki projektu"
              className="flex items-center sm:gap-2"
            >
              <a
                href="https://github.com/Suchy702/simplefund/tree/master"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub — kod projektu (otwiera nową kartę)"
                title="GitHub — kod projektu"
                className="inline-flex h-8 w-8 items-center justify-center gap-2 rounded-sm text-ink-2 transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:px-3"
              >
                <Github size={16} aria-hidden="true" />
                <span className="hidden text-xs lg:inline">GitHub</span>
              </a>
              <a
                href="https://buycoffee.to/simplefund"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Wesprzyj projekt na BuyCoffee (otwiera nową kartę)"
                title="Wesprzyj projekt"
                className="inline-flex h-8 w-8 items-center justify-center gap-2 rounded-sm text-brand-ink transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:px-3"
              >
                <span
                  aria-hidden="true"
                  className="h-[18px] w-[18px] shrink-0 bg-current"
                  style={{
                    mask: 'url(/buycoffee.png) center / contain no-repeat',
                    WebkitMask:
                      'url(/buycoffee.png) center / contain no-repeat',
                  }}
                />
                <span className="hidden text-xs lg:inline">
                  Wesprzyj projekt
                </span>
              </a>
            </nav>
            <div className="flex items-center border-l border-border pl-1 sm:gap-2 sm:pl-5">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="w-7 sm:w-8"
                aria-label={
                  theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'
                }
              >
                {theme === 'dark' ? (
                  <Sun size={16} aria-hidden="true" />
                ) : (
                  <Moon size={16} aria-hidden="true" />
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={onGoToLogin}
                className="px-1 text-xs sm:px-3 sm:text-13"
              >
                Zaloguj się
              </Button>
              <Button
                variant="brand"
                onClick={onGoToRegister}
                className="landing-primary-button hidden sm:inline-flex"
              >
                Załóż konto <ArrowRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main id="main">
        <section
          className="landing-hero mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12 lg:pb-16 lg:pt-8"
          aria-labelledby="intro-title"
        >
          <div className="max-w-[480px]">
            <h1
              id="intro-title"
              className="text-[clamp(2.6rem,4.5vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.055em]"
            >
              Wiele inwestycji.
              <br />
              Jeden{' '}
              <span className="landing-title-accent text-primary">
                prosty widok.
              </span>
            </h1>
            <p className="mt-6 max-w-[420px] text-base leading-relaxed text-ink-2">
              Akcje, obligacje, lokaty i złoto. SimpleFund zbiera Twoje
              inwestycje w jednym portfelu, żeby łatwiej było zobaczyć ich
              wartość, skład i wyniki.
            </p>
            <div data-reveal className="mt-8 flex flex-wrap gap-3">
              <Button
                variant="brand"
                size="lg"
                className="landing-primary-button h-12 px-6"
                onClick={onGoToRegister}
              >
                Stwórz swój portfel <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="lg" className="h-12" asChild>
                <a href="#instrumenty" onClick={scrollToFeatures}>
                  Poznaj możliwości <ArrowDown size={15} aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
          <div className="landing-hero-preview mx-auto w-full min-w-0 max-w-[620px] lg:pt-4">
            <LandingPortfolioPreview />
          </div>
        </section>

        <section
          id="instrumenty"
          tabIndex={-1}
          aria-label="Obsługiwane aktywa"
          className="border-y border-border bg-card focus:outline-none"
        >
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-5 gap-y-5 px-5 py-6 sm:grid-cols-3 sm:px-8 lg:grid-cols-6">
            {assetTypes.map(({ icon: Icon, name }) => (
              <div
                key={name}
                className="landing-asset flex items-center justify-center gap-2 text-xs font-medium text-ink-2"
              >
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-primary"
                  aria-hidden="true"
                />
                {name}
              </div>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="holdings-title"
          className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-24"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                01 / Twój portfel
              </p>
              <h2
                id="holdings-title"
                className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
              >
                Każda inwestycja.
                <br />W jednym zestawieniu.
              </h2>
            </div>
            <p className="max-w-[340px] text-sm leading-relaxed text-ink-2">
              Od pojedynczych instrumentów do całego portfela. Sprawdź, co
              posiadasz i jaki jest wynik każdej pozycji.
            </p>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card className="landing-card min-w-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle>Twoje aktywa</CardTitle>
              </CardHeader>
              <Table
                aria-label="Aktywa w SimpleFund"
                containerClassName="overflow-y-hidden"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Aktywo</TableHead>
                    <TableHead className="text-right">Wolumen</TableHead>
                    <TableHead className="text-right">Wkład (PLN)</TableHead>
                    <TableHead className="text-right">Wartość (PLN)</TableHead>
                    <TableHead className="text-right">Bilans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {landingHoldings.map((holding) => (
                    <TableRow key={holding.ticker}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <TickerBadge
                            ticker={holding.ticker}
                            color={holding.color}
                          />
                          <div>
                            <p className="font-medium">{holding.ticker}</p>
                            <p className="mt-0.5 text-tiny text-ink-3">
                              {holding.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular">
                        {fmtNumber(holding.qty)}{' '}
                        <span className="text-[10px] text-ink-3">
                          {holding.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular">
                        {fmtNumber(holding.cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium tabular">
                        {fmtNumber(holding.value)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`font-mono tabular ${holding.change > 0 ? 'text-pos' : 'text-ink-2'}`}
                          >
                            {fmtMoney(holding.change, '', { sign: true })}
                          </span>
                          <DeltaPill value={holding.changePct} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1 lg:gap-6 lg:py-2">
              {[
                {
                  title: 'Wartość w PLN',
                  text: 'Wspólna waluta ułatwia porównanie inwestycji. Kursy walut dostarcza Frankfurter.',
                },
                {
                  title: 'Wkład i bilans',
                  text: 'Zobacz wartość pozycji obok kwoty, którą w nią zainwestowano.',
                },
                {
                  title: 'Operacje pod kontrolą',
                  text: 'Dodawaj zakupy, sprzedaże, wpłaty i wypłaty. W historii operacji sprawdzisz ich daty i kwoty.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="landing-step border-l-2 border-border pl-4"
                >
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-3">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="import-title"
          className="border-y border-border bg-surface-subtle"
        >
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                02 / Import z XTB
              </p>
              <h2
                id="import-title"
                className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
              >
                Twój raport.
                <br />
                Gotowe operacje.
              </h2>
              <p className="mt-5 max-w-[370px] text-sm leading-relaxed text-ink-2">
                Przenieś transakcje i przepływy pieniężne z raportu XTB do
                portfela. Sprawdź dane przed zapisaniem.
              </p>
              <ol className="mt-7 space-y-5">
                {[
                  {
                    title: 'Wczytaj raport XLSX',
                    text: 'Pobierz historię z XTB i dodaj plik w SimpleFund.',
                  },
                  {
                    title: 'Sprawdź instrumenty',
                    text: 'Przejrzyj podgląd i dopasowania. W razie potrzeby wybierz właściwy instrument.',
                  },
                  {
                    title: 'Zatwierdź import',
                    text: 'Dane zapisują się po Twoim zatwierdzeniu. Powtórzone operacje zostaną pominięte.',
                  },
                ].map((step, index) => (
                  <li key={step.title} className="landing-step flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card font-mono text-[10px] text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-3">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="min-w-0">
              <LandingXtbPreview />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="statistics-title"
          className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-24"
        >
          <div className="mb-9 grid gap-5 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                03 / Wskaźniki i struktura
              </p>
              <h2
                id="statistics-title"
                className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
              >
                Wynik w liczbach.
                <br />
                Skład na wykresie.
              </h2>
            </div>
            <div className="max-w-xl">
              <p className="text-sm leading-relaxed text-ink-2">
                Wkład własny i bilans pokazują, ile inwestujesz i jaki jest
                wynik portfela. ROI opisuje całkowity zwrot, a XIRR uwzględnia
                daty przepływów pieniężnych.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                Wykres kołowy pokazuje udziały klas aktywów i konkretnych
                pozycji. Procenty obok ułatwiają sprawdzenie proporcji.
              </p>
            </div>
          </div>
          <LandingStatisticsPreview />
        </section>

        <section
          aria-labelledby="history-title"
          className="border-y border-border bg-surface-subtle"
        >
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-12">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                04 / Wyniki historyczne
              </p>
              <h2
                id="history-title"
                className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
              >
                Zobacz, jak zmieniał
                <br />
                się Twój portfel.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-ink-2">
                Historia zestawia wartość portfela z wkładem własnym. Widzisz
                zmiany wyceny na tle pieniędzy, które wpłacasz i wypłacasz.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                Przeliczenie uruchamiasz w panelu. Historia uwzględnia również
                sprzedane pozycje. Brak notowań lub zapisanych kursów może
                powodować przerwy na wykresie.
              </p>
            </div>
            <div className="min-w-0">
              <LandingHistoryPreview />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="start-title"
          className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20"
        >
          <div className="landing-card landing-cta grid gap-8 rounded-lg border border-border-strong bg-card p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                Koszty?
              </p>
              <h2
                id="start-title"
                className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Za darmo to uczciwa cena.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
                Korzystaj z SimpleFund bez opłat. Załóż konto i zbierz swoje
                inwestycje w jednym miejscu — zacznij od pierwszej operacji.
              </p>
            </div>
            <Button
              variant="brand"
              size="lg"
              className="landing-primary-button h-12 justify-self-start px-6"
              onClick={onGoToRegister}
            >
              Załóż darmowe konto <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>

      <footer data-reveal className="border-t border-border bg-card">
        <p className="px-5 py-3 text-center text-xs leading-6 text-ink-3 sm:px-8">
          {' '}
          <a
            href="mailto:simplefund.kontakt@gmail.com"
            className="font-semibold text-brand-ink hover:underline"
          >
            simplefund.kontakt@gmail.com
          </a>
        </p>
      </footer>
    </div>
  )
}

export default LandingPage
