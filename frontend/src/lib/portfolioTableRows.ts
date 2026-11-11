import {
  OPERATION_LABELS,
  type Holding,
  type Operation,
} from '@/types/portfolio'

type Controls = Record<string, string>
type SortValue = string | number | null | undefined
const collator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' })
const contains = (text: string, query = '') =>
  text.toLocaleLowerCase('pl').includes(query.trim().toLocaleLowerCase('pl'))

const sorted = <T>(
  rows: T[],
  params: Controls,
  key: (row: T) => SortValue
): T[] => {
  if (!params.sort) return rows
  return [...rows].sort((a, b) => {
    const left = key(a)
    const right = key(b)
    if (left == null) return right == null ? 0 : 1
    if (right == null) return -1
    const comparison =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : collator.compare(String(left), String(right))
    return params.direction === 'desc' ? -comparison : comparison
  })
}

export const filterHoldings = (
  rows: Holding[],
  params: Controls
): Holding[] => {
  const filtered = rows.filter(
    (row) =>
      contains(`${row.ticker} ${row.name}`, params.name) &&
      (!params.kind || row.class === params.kind)
  )
  return sorted(filtered, params, (row) => {
    switch (params.sort) {
      case 'name':
        return row.name
      case 'cost':
        return row.cost
      case 'value':
        return row.value
      case 'change':
        return row.change
      default:
        return null
    }
  })
}

export const filterOperations = (
  rows: Operation[],
  params: Controls
): Operation[] => {
  const filtered = rows.filter(
    (row) =>
      contains(row.name, params.name) &&
      (!params.kind || row.kind === params.kind) &&
      (!params.operation_type || row.type === params.operation_type) &&
      (!params.currency || row.currency === params.currency) &&
      (!params.date_from || row.date >= params.date_from) &&
      (!params.date_to || row.date <= params.date_to)
  )
  return sorted(filtered, params, (row) => {
    switch (params.sort) {
      case 'name':
        return row.name
      case 'kind':
        return row.kind
      case 'type':
        return row.sourceLabel ?? OPERATION_LABELS[row.type]
      case 'currency':
        return row.currency
      case 'value_pln':
        return row.valuePln
      case 'date':
        return row.date
      default:
        return null
    }
  })
}
