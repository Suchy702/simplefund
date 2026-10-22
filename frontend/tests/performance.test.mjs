import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculatePerformanceStats,
  formatSeriesDate,
} from '../src/lib/performance.ts'
import {
  generateSeries,
  MOCK_AS_OF_DATE,
  MOCK_KPI,
} from '../src/mocks/portfolio.ts'

const point = (date, value) => ({ date, value })

test('performance statistics preserve values and attach extrema to observation dates', () => {
  const series = [
    point('2026-01-01', 120),
    point('2026-01-02', 100),
    point('2026-01-03', 110),
  ]
  const before = structuredClone(series)
  const stats = calculatePerformanceStats(series)
  assert.equal(stats.peak, 120)
  assert.equal(stats.trough, 100)
  assert.equal(stats.peakDate, '2026-01-01')
  assert.equal(stats.troughDate, '2026-01-02')
  assert.equal(stats.maxDd, -20 / 120)
  assert.equal(stats.maxDdPln, -20)
  assert.ok(Math.abs(stats.stdPct - (Math.sqrt(200 / 3) / 110) * 100) < 1e-12)
  assert.deepEqual(series, before)
})

test('empty and single-observation series have defined statistics', () => {
  assert.equal(calculatePerformanceStats([]), null)
  assert.deepEqual(calculatePerformanceStats([point('2026-01-01', 100)]), {
    peak: 100,
    trough: 100,
    peakDate: '2026-01-01',
    troughDate: '2026-01-01',
    stdPct: 0,
    maxDd: 0,
    maxDdPln: 0,
  })
})

test('repeated extrema retain the first observation date', () => {
  const stats = calculatePerformanceStats([
    point('2026-01-01', 120),
    point('2026-01-02', 100),
    point('2026-01-03', 120),
    point('2026-01-04', 100),
  ])
  assert.equal(stats.peakDate, '2026-01-01')
  assert.equal(stats.troughDate, '2026-01-02')
})

const ranges = [
  ['1M', 30, '2026-03-25'],
  ['3M', 65, '2026-01-25'],
  ['6M', 130, '2025-10-25'],
  ['1R', 250, '2025-04-25'],
  ['MAX', 380, '2021-04-25'],
]

for (const [range, count, startDate] of ranges) {
  test(`${range} mock series has ordered dates, stable values and a shared reporting date`, () => {
    const series = generateSeries(range)
    assert.equal(series.length, count)
    assert.equal(series[0].date, startDate)
    assert.equal(series.at(-1).date, MOCK_AS_OF_DATE)
    assert.equal(series.at(-1).value, MOCK_KPI.totalValue)
    assert.deepEqual(series, generateSeries(range))
    for (let i = 0; i < series.length; i++) {
      assert.ok(Number.isFinite(series[i].value))
      if (i > 0) assert.ok(series[i].date > series[i - 1].date)
    }
    const stats = calculatePerformanceStats(series)
    assert.ok(
      series.some((p) => p.date === stats.peakDate && p.value === stats.peak)
    )
    assert.ok(
      series.some(
        (p) => p.date === stats.troughDate && p.value === stats.trough
      )
    )
  })
}

test('all consumers can format observation dates in Polish', () => {
  assert.equal(formatSeriesDate('2026-04-25'), '25 kwi 2026')
})
