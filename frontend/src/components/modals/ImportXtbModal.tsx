import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, FileSpreadsheet, Upload, X } from 'lucide-react'

import { useStockSearch } from '@/api/portfolio'
import {
  useXtbImport,
  type XtbChoice,
  type XtbInstrument,
  type XtbPreview,
} from '@/api/xtb'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  CURRENCIES,
  type Currency,
  type StockInstrument,
} from '@/types/portfolio'

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
const statusLabels = {
  automatic: 'Dopasowano automatycznie — sprawdź',
  saved: 'Zapisane dopasowanie — sprawdź',
  changed: 'Twój wybór — zatwierdź',
  unresolved: 'Wymaga wyboru',
}

function InstrumentRow({
  instrument,
  choice,
  onChange,
}: {
  instrument: XtbInstrument
  choice: XtbChoice
  onChange: (choice: XtbChoice) => void
}) {
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<StockInstrument | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [query])
  const search = useStockSearch(
    debounced,
    (editing || choice.mode === 'unresolved') && debounced.length > 0
  )
  const selected = [picked, instrument.selected, ...instrument.candidates].find(
    (candidate) => candidate?.ticker === choice.ticker
  )
  const choose = (candidate: StockInstrument) => {
    setPicked(candidate)
    onChange({ mode: 'yahoo', ticker: candidate.ticker })
    setEditing(false)
    setQuery('')
  }
  const status =
    JSON.stringify(choice) === JSON.stringify(instrument.choice)
      ? instrument.status
      : 'changed'
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {instrument.sourceTicker} · {instrument.name}
          </p>
          <p className="text-xs text-ink-3">XTB · {instrument.category}</p>
        </div>
        <span className="rounded bg-brand-soft px-2 py-1 text-xs text-brand-ink">
          {statusLabels[status]}
        </span>
      </div>
      {choice.mode === 'yahoo' && selected && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle p-3">
          <div className="text-sm">
            <p className="font-medium">
              Yahoo: {selected.ticker} · {selected.name}
            </p>
            <p className="text-xs text-ink-3">
              {selected.exchange ?? 'Brak giełdy'} ·{' '}
              {selected.currency ?? 'Brak waluty'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(!editing)}
          >
            Zmień
          </Button>
        </div>
      )}
      {instrument.warning && (
        <p className="text-xs text-ink-3">{instrument.warning}</p>
      )}
      {instrument.issues.map((issue) => (
        <p
          key={issue}
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {issue}
        </p>
      ))}
      <label className="block space-y-1 text-xs text-ink-3">
        <span>Sposób wyceny {instrument.sourceTicker}</span>
        <select
          className={selectClass}
          value={choice.mode === 'unresolved' ? 'yahoo' : choice.mode}
          onChange={(event) => {
            const mode = event.target.value as XtbChoice['mode']
            onChange(
              mode === 'yahoo' && selected
                ? { mode, ticker: selected.ticker }
                : { mode }
            )
            setEditing(mode === 'yahoo')
          }}
        >
          <option value="yahoo">Notowania Yahoo</option>
          <option value="skip">Pomiń instrument</option>
        </select>
      </label>
      {(choice.mode === 'unresolved' ||
        (choice.mode === 'yahoo' && (editing || !selected))) && (
        <div className="space-y-2">
          <Input
            aria-label={`Wyszukaj w Yahoo: ${instrument.sourceTicker}`}
            placeholder="Nazwa lub symbol Yahoo"
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div
            className="max-h-48 space-y-1 overflow-y-auto"
            aria-live="polite"
          >
            {search.isFetching && (
              <p className="text-xs text-ink-3">Wyszukiwanie Yahoo…</p>
            )}
            {search.isError && (
              <p role="alert" className="text-xs text-destructive">
                {search.error.message}
              </p>
            )}
            {(debounced ? (search.data ?? []) : instrument.candidates).map(
              (candidate) => (
                <button
                  key={candidate.ticker}
                  type="button"
                  disabled={!candidate.canTransact}
                  className="block w-full rounded-md border border-border p-2 text-left text-sm hover:bg-surface-subtle disabled:opacity-50"
                  onClick={() => choose(candidate)}
                >
                  <span className="font-medium">{candidate.ticker}</span> ·{' '}
                  {candidate.name}
                  <span className="block text-xs text-ink-3">
                    {candidate.exchange} · {candidate.currency}{' '}
                    {candidate.unavailableReason}
                  </span>
                </button>
              )
            )}
            {debounced &&
              !search.isFetching &&
              !search.isError &&
              search.data?.length === 0 && (
                <p className="text-xs text-ink-3">
                  Brak wyników. Zmień zapytanie lub pomiń instrument.
                </p>
              )}
          </div>
        </div>
      )}
      {choice.mode === 'skip' && (
        <p className="text-xs text-ink-3">
          Pominiemy nowe transakcje instrumentu, zachowując rzeczywiste
          przepływy gotówki. Portfel nie obejmie pominiętych transakcji. Możesz
          zaimportować je później, ponownie dodając pełną historię.
        </p>
      )}
    </div>
  )
}

export function ImportXtbModal({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [preview, setPreview] = useState<XtbPreview | null>(null)
  const [choices, setChoices] = useState<Record<string, XtbChoice>>({})
  const [currencies, setCurrencies] = useState<Record<string, Currency | ''>>(
    {}
  )
  const [dirty, setDirty] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const { analyze, resolve, commit } = useXtbImport()
  const busy = analyze.isPending || resolve.isPending || commit.isPending
  const reviewing = preview !== null
  const result = commit.data
  const markPreviewDirty = () => {
    setDirty(true)
    commit.reset()
    resolve.reset()
  }
  const acceptPreview = (next: XtbPreview) => {
    setPreview(next)
    setChoices(
      Object.fromEntries(
        next.instruments.map((instrument) => [
          instrument.sourceTicker,
          instrument.choice,
        ])
      )
    )
    setCurrencies(
      Object.fromEntries(
        next.accounts.map((account) => [
          account.account,
          account.currency ?? '',
        ])
      )
    )
    setDirty(false)
  }
  const changeFiles = (next: File[]) => {
    setFiles(next)
    setPreview(null)
    analyze.reset()
    resolve.reset()
    commit.reset()
  }
  const addFiles = (incoming: File[]) => {
    if (busy || result || preview) return
    if (incoming.length !== 1) {
      setFileError('Dodaj jeden plik XLSX naraz.')
      return
    }
    const file = incoming[0]
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setFileError('Dodaj plik XLSX. Archiwum ZIP najpierw rozpakuj.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('Maksymalny rozmiar pliku to 10 MB.')
      return
    }
    setFileError(null)
    changeFiles([file])
  }
  const error =
    fileError ??
    analyze.error?.message ??
    resolve.error?.message ??
    commit.error?.message
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!busy) onOpenChange(open)
      }}
    >
      <DialogContent
        className="max-h-[90dvh] max-w-3xl overflow-y-auto"
        showCloseButton={!result}
        onPaste={(event) => {
          if (event.clipboardData.files.length) {
            event.preventDefault()
            addFiles(Array.from(event.clipboardData.files))
          }
        }}
      >
        <DialogHeader className={reviewing ? 'sr-only' : undefined}>
          <DialogTitle>Importuj z XTB</DialogTitle>
          <DialogDescription>
            Dodaj raport XLSX, sprawdź instrumenty i zatwierdź import.
            Powtórzone operacje zostaną pominięte.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div role="status" className="space-y-3">
            <p className="flex items-center gap-2 font-medium">
              <Check size={18} />
              Import zakończony
            </p>
            <p className="text-sm">
              Dodano operacji źródłowych: {result.imported}. Duplikaty:{' '}
              {result.duplicates}. Pominięte transakcje instrumentów:{' '}
              {result.skippedTrades}.
            </p>
            {result.skippedTrades > 0 && (
              <p className="text-sm text-ink-3">
                Wartość portfela nie obejmuje pominiętych instrumentów.
              </p>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zamknij
            </Button>
          </div>
        ) : (
          <>
            {!reviewing && (
              <>
                <details
                  className="rounded-lg border border-border p-3 text-sm"
                  open={!preview}
                >
                  <summary className="cursor-pointer font-medium">
                    Skąd pobrać raport XTB?
                  </summary>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-3">
                    <li>Zaloguj się do platformy XTB w przeglądarce.</li>
                    <li>W „Historii” wybierz rachunek i pełny zakres dat.</li>
                    <li>Pobierz raport w formacie Excel (.xlsx).</li>
                    <li>
                      Dodaj plik tutaj. Jeśli pobierzesz ZIP, najpierw go
                      rozpakuj.
                    </li>
                  </ol>
                  <a
                    className="mt-3 inline-block underline"
                    href="https://www.xtb.com/pl/centrum-pomocy/platformy-tradingowe/historia-pozycji-oraz-operacji-gotowkowych-web-i-aplikacja-mobilna"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Pomoc XTB historia operacji
                  </a>
                </details>
                <div
                  className="rounded-lg border-2 border-dashed border-border p-5 text-center"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    addFiles(Array.from(event.dataTransfer.files))
                  }}
                >
                  <Upload className="mx-auto mb-2 text-ink-3" size={22} />
                  <p className="mb-3 text-sm text-ink-3">
                    Przeciągnij lub wklej plik XLSX
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => input.current?.click()}
                  >
                    Wybierz plik
                  </Button>
                  <input
                    ref={input}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    aria-label="Raport XTB XLSX"
                    disabled={busy}
                    onChange={(event) => {
                      addFiles(Array.from(event.target.files ?? []))
                      event.target.value = ''
                    }}
                  />
                  <p className="mt-2 text-xs text-ink-3">
                    Jeden plik XLSX · do 10 MB
                  </p>
                </div>
                <p className="text-xs text-ink-3">
                  Raport PLN zawiera transfery na IKE, nie ma konieczności
                  imporotwania go osobno.
                </p>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <FileSpreadsheet size={16} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {file.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          aria-label={`Usuń ${file.name}`}
                          onClick={() => {
                            setFileError(null)
                            changeFiles(
                              files.filter(
                                (_, fileIndex) => fileIndex !== index
                              )
                            )
                          }}
                        >
                          <X size={14} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {!preview && (
                  <Button
                    variant="brand"
                    disabled={!files.length || busy}
                    aria-busy={analyze.isPending}
                    aria-live="polite"
                    onClick={() =>
                      analyze.mutate(files, { onSuccess: acceptPreview })
                    }
                  >
                    {analyze.isPending ? 'Analizuję…' : 'Przeanalizuj plik'}
                  </Button>
                )}
              </>
            )}
            {preview && (
              <>
                <fieldset disabled={busy} className="space-y-4">
                  <legend className="mb-2 text-sm font-semibold">
                    Rachunki i waluty rozliczenia
                  </legend>
                  {preview.accounts.map((account, index) => (
                    <label
                      key={`${account.filename}-${index}`}
                      className="flex flex-wrap items-center gap-3 text-sm"
                    >
                      <span className="min-w-0 flex-1 break-all">
                        {account.filename} · {account.operationCount} operacji
                      </span>
                      {account.isIke ? (
                        <span className="text-sm font-medium">PLN</span>
                      ) : (
                        <select
                          className={`${selectClass} max-w-28`}
                          value={currencies[account.account]}
                          aria-label={`Waluta rachunku ${account.account}`}
                          onChange={(event) => {
                            markPreviewDirty()
                            setCurrencies({
                              ...currencies,
                              [account.account]: event.target.value as Currency,
                            })
                          }}
                        >
                          <option value="">Wybierz</option>
                          {CURRENCIES.map((currency) => (
                            <option key={currency}>{currency}</option>
                          ))}
                        </select>
                      )}
                    </label>
                  ))}
                  {preview.warnings.length > 0 && (
                    <ul className="space-y-1 text-xs text-ink-3">
                      {preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm font-semibold">
                    Dopasowania instrumentów
                  </p>
                  <p className="text-xs text-ink-3">
                    Sprawdź symbol, giełdę, walutę i właściwy fundusz.
                    Automatyczna propozycja wymaga Twojego potwierdzenia.
                  </p>
                  {preview.instruments.map((instrument) => (
                    <InstrumentRow
                      key={instrument.sourceTicker}
                      instrument={instrument}
                      choice={choices[instrument.sourceTicker]}
                      onChange={(choice) => {
                        markPreviewDirty()
                        setChoices({
                          ...choices,
                          [instrument.sourceTicker]: choice,
                        })
                      }}
                    />
                  ))}
                </fieldset>
                {dirty ? (
                  <div className="space-y-2">
                    <p className="text-sm text-ink-3">
                      Zastosuj zmiany, aby backend zaktualizował podgląd.
                    </p>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        Object.values(currencies).some((currency) => !currency)
                      }
                      onClick={() =>
                        resolve.mutate(
                          { preview, choices, currencies },
                          { onSuccess: acceptPreview }
                        )
                      }
                    >
                      {resolve.isPending ? 'Aktualizacja…' : 'Zastosuj zmiany'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      className="rounded-lg bg-surface-subtle p-3 text-sm"
                      aria-live="polite"
                    >
                      Nowe operacje: {preview.summary.newOperations} ·
                      Duplikaty: {preview.summary.duplicates} · Pominięte
                      transakcje instrumentów: {preview.summary.skippedTrades}
                      <p className="mt-1 text-xs text-ink-3">
                        Operacja źródłowa zakupu lub sprzedaży obejmuje
                        instrument i osobne rozliczenie gotówkowe.
                      </p>
                    </div>
                    {preview.errors.length > 0 && (
                      <ul
                        role="alert"
                        className="space-y-1 text-sm text-destructive"
                      >
                        {preview.errors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <Button
                  variant="brand"
                  disabled={busy || dirty || !preview.canImport}
                  onClick={() => commit.mutate(preview)}
                >
                  {commit.isPending ? 'Importowanie…' : 'Zatwierdź i importuj'}
                </Button>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {(resolve.isPending || commit.isPending) && (
              <p role="status" className="text-xs text-ink-3">
                Trwa przetwarzanie. Wyszukiwanie notowań i pobieranie kursów
                może chwilę potrwać.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
