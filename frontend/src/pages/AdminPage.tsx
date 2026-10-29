import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'

import {
  useBackendConnections,
  useCryptoConnection,
  useExternalConnection,
  useStockConnection,
  useSupabaseConnection,
  type ConnectionCheck,
} from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Topbar } from '@/components/Topbar'

const adminLinks = [
  {
    name: 'GitHub · SimpleFund',
    href: 'https://github.com/Suchy702/simplefund/tree/master',
  },
  { name: 'SimpleFund', href: '/' },
  { name: 'BuyCoffee.to', href: 'https://buycoffee.to/simplefund' },
  { name: 'cron-job.org', href: 'https://console.cron-job.org/dashboard' },
  { name: 'Trello', href: 'https://trello.com/b/z8WWXa4t/simplefund' },
]

interface ConnectionRowProps {
  name: string
  description: string
  result?: ConnectionCheck
  loading: boolean
  error?: string
}

const ConnectionRow = ({
  name,
  description,
  result,
  loading,
  error,
}: ConnectionRowProps) => {
  const status = loading ? 'loading' : error ? 'error' : result?.status
  const Icon =
    status === 'loading'
      ? Loader2
      : status === 'ok'
        ? CircleCheck
        : status === 'error'
          ? CircleX
          : Clock
  const label =
    status === 'loading'
      ? 'Sprawdzanie…'
      : status === 'ok'
        ? 'Połączono'
        : status === 'error'
          ? 'Błąd testu'
          : 'Nie sprawdzono'

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{name}</h3>
        <span
          className={`flex items-center gap-1.5 text-13 ${
            status === 'ok'
              ? 'text-emerald-600 dark:text-emerald-400'
              : status === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
          }`}
        >
          <Icon size={15} className={loading ? 'animate-spin' : undefined} />
          {label}
        </span>
      </div>
      <p className="mt-1 text-13 text-muted-foreground">{description}</p>
      {!loading && (
        <p className="mt-2 text-13">
          {error ?? result?.detail ?? 'Test wymaga połączenia z backendem.'}
        </p>
      )}
      {!loading && result && !error && (
        <>
          {result.rates && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(result.rates).map(([code, rate]) => (
                <div
                  key={code}
                  className="rounded-sm bg-muted px-3 py-2 text-13"
                >
                  <span className="block text-muted-foreground">1 {code}</span>
                  <span className="font-medium tabular-nums">
                    {rate.toLocaleString('pl-PL', {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}{' '}
                    PLN
                  </span>
                  {result.rate_dates?.[code] && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {result.rate_dates[code]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {result.rates && (
            <p className="mt-2 text-13 text-muted-foreground">
              Kursy dzienne, nie notowania na żywo.
            </p>
          )}
          {result.price != null && (
            <p className="mt-3 text-sm font-medium tabular-nums">
              {result.symbol}:{' '}
              {result.price.toLocaleString('pl-PL', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}{' '}
              {result.currency}
              <span className="mt-1 block text-13 font-normal text-muted-foreground">
                Data notowania: {result.price_date}. Ostatni dzienny kurs
                zamknięcia.
              </span>
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Sprawdzono: {new Date(result.checked_at).toLocaleString('pl-PL')}
            {result.response_time_ms != null &&
              ` · Czas odpowiedzi: ${result.response_time_ms} ms`}
          </p>
          {result.source_url && (
            <a
              href={result.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-13 text-muted-foreground underline underline-offset-4"
            >
              Otwórz źródło
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </>
      )}
    </div>
  )
}

const AdminPage = ({ onBack }: { onBack: () => void }) => {
  const database = useSupabaseConnection(true)
  const backend = useBackendConnections(true)
  const stocks = useStockConnection(true)
  const crypto = useCryptoConnection(true)
  const bonds = useExternalConnection('bonds', true)
  const nbp = useExternalConnection('nbp', true)
  const gus = useExternalConnection('gus', true)
  const historyYahoo = useExternalConnection('history-yahoo', true)
  const historyFx = useExternalConnection('history-fx', true)
  const sources = [
    {
      name: 'Historia notowań · Yahoo Finance',
      description:
        'Dzienne zamknięcia akcji, ETF, indeksów, krypto i futures; historyczne wyceny portfela. Kontrola serii AAPL z ostatnich 14 dni; wynik kontroli pamiętany do 5 minut.',
      query: historyYahoo,
    },
    {
      name: 'Historia kursów · Frankfurter',
      description:
        'Wykresy odczytują kursy do PLN wyłącznie z bazy, bez pobierania braków. Osobna kontrola dostawcy pobiera serię EUR/PLN z ostatnich 14 dni; wynik kontroli pamiętany do 5 minut.',
      query: historyFx,
    },
    {
      name: 'Obligacje skarbowe',
      description:
        'obligacjeskarbowe.pl · dostępność serwisu obligacji skarbowych.',
      query: bonds,
    },
    {
      name: 'Stopy procentowe · NBP',
      description:
        'nbp.pl · dostępność strony podstawowych stóp procentowych NBP.',
      query: nbp,
    },
    {
      name: 'Inflacja · GUS',
      description:
        'stat.gov.pl · dostępność strony miesięcznych wskaźników cen konsumpcyjnych.',
      query: gus,
    },
  ]
  const checking =
    database.isFetching ||
    backend.isFetching ||
    stocks.isFetching ||
    crypto.isFetching ||
    sources.some(({ query }) => query.isFetching)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <Topbar isAdmin adminActive />
      <main className="flex-1 overflow-y-auto px-8 pb-12 pt-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <Button variant="ghost" size="sm" className="mb-6" onClick={onBack}>
            <ArrowLeft size={14} />
            Powrót do portfela
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Panel admina
          </h1>
          <p className="mb-8 mt-2 text-sm text-muted-foreground">
            Diagnostyka usług używanych przez SimpleFund.
          </p>

          <section aria-labelledby="links-heading" className="mb-8 max-w-3xl">
            <h2 id="links-heading" className="mb-4 text-base font-semibold">
              Przydatne linki
            </h2>
            <div className="flex flex-wrap gap-2">
              {adminLinks.map(({ name, href }) => (
                <Button key={name} variant="outline" size="sm" asChild>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {name}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </Button>
              ))}
            </div>
          </section>

          <section aria-labelledby="connection-heading" className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="connection-heading" className="text-base font-semibold">
                Testowanie połączenia
              </h2>
              <Button
                size="sm"
                disabled={checking}
                onClick={() => {
                  void database.refetch()
                  void backend.refetch()
                  void stocks.refetch()
                  void crypto.refetch()
                  sources.forEach(({ query }) => {
                    void query.refetch()
                  })
                }}
              >
                <RefreshCw
                  size={14}
                  className={checking ? 'animate-spin' : ''}
                />
                Sprawdź ponownie
              </Button>
            </div>
            <div className="space-y-3" aria-live="polite" aria-busy={checking}>
              <ConnectionRow
                name="Baza danych Supabase"
                description="Odczyt danych z bazy projektu SimpleFund."
                result={database.isError ? undefined : database.data}
                loading={database.isFetching}
                error={
                  database.isError
                    ? 'Nie udało się wykonać testu bazy.'
                    : undefined
                }
              />
              <ConnectionRow
                name="Backend"
                description="API SimpleFund · czas odpowiedzi obejmuje test Frankfurter."
                result={backend.isError ? undefined : backend.data?.backend}
                loading={backend.isFetching}
                error={backend.isError ? backend.error.message : undefined}
              />
              <ConnectionRow
                name="Kursy walut · Frankfurter"
                description="Kursy EUR, USD, GBP i CHF względem PLN · bez opłat i klucza API."
                result={backend.isError ? undefined : backend.data?.currency}
                loading={backend.isFetching}
              />
              <ConnectionRow
                name="Notowania spółek · yfinance"
                description="Yahoo Finance · test pobrania notowania Apple (AAPL)."
                result={stocks.isError ? undefined : stocks.data}
                loading={stocks.isFetching}
                error={stocks.isError ? stocks.error.message : undefined}
              />
              <ConnectionRow
                name="Kryptowaluty · yfinance"
                description="Yahoo Finance · dzienne ceny kryptowalut i historia. Test zamkniętego notowania Bitcoin (BTC-USD)."
                result={crypto.isError ? undefined : crypto.data}
                loading={crypto.isFetching}
                error={crypto.isError ? crypto.error.message : undefined}
              />
              {sources.map(({ name, description, query }) => (
                <ConnectionRow
                  key={name}
                  name={name}
                  description={description}
                  result={query.isError ? undefined : query.data}
                  loading={query.isFetching}
                  error={query.isError ? query.error.message : undefined}
                />
              ))}
            </div>
            <p className="mt-3 text-13 text-muted-foreground">
              Kontrole obligacji, NBP i GUS sprawdzają odpowiedź HTTP serwisu,
              bez weryfikacji aktualności publikowanych danych.
            </p>
            <a
              href="https://frankfurter.dev/"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-13 text-muted-foreground underline underline-offset-4"
            >
              Dokumentacja Frankfurter
            </a>
          </section>
        </div>
      </main>
    </div>
  )
}

export default AdminPage
