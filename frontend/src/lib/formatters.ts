type FmtOpts = { sign?: boolean }

export function fmtMoney(
  n: number,
  ccy: string = 'PLN',
  opts: FmtOpts = {}
): string {
  const positiveSign = opts.sign && n > 0 ? '+' : ''
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const negSign = n < 0 ? '−' : ''
  return `${positiveSign}${negSign}${formatted}${ccy ? ' ' + ccy : ''}`
}

export function fmtPct(n: number, opts: FmtOpts = {}): string {
  const positiveSign = opts.sign && n > 0 ? '+' : ''
  const negSign = n < 0 ? '−' : ''
  return `${positiveSign}${negSign}${Math.abs(n).toFixed(2)}%`
}

export function fmtNumber(n: number, fractionDigits: number = 2): string {
  return n.toLocaleString('pl-PL', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}
