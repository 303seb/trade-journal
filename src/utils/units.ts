// Shared money-unit handling: Dollars / Ticks / Risk-to-Reward (R)

export const PV: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }
// tick value = point value × tick size (NQ/ES tick 0.25, GC tick 0.10)
export const TICK_VALUE: Record<string, number> = { NQ: 5, MNQ: 0.5, ES: 12.5, MES: 1.25, GC: 10, MGC: 1 }

export type MoneyUnit = 'dollars' | 'ticks' | 'rr'

export const UNIT_LABEL: Record<MoneyUnit, string> = { dollars: 'Dollars', ticks: 'Ticks', rr: 'R:R' }

const num = (s?: string) => parseFloat(s || '') || 0

export type UnitTrade = { pnl: string; fees?: string; symbol: string; stopLoss?: string; contracts?: string }

// A single trade's magnitude in the chosen unit.
// Dollars = net (after fees); Ticks / R = gross price movement.
export function tradeUnitValue(t: UnitTrade, unit: MoneyUnit): number {
  const gross = num(t.pnl)
  if (unit === 'dollars') return gross - num(t.fees)
  if (unit === 'ticks') { const tv = TICK_VALUE[t.symbol]; return tv ? gross / tv : 0 }
  const risk = num(t.stopLoss) * (PV[t.symbol] || 0) * num(t.contracts)
  return risk > 0 ? gross / risk : 0
}

export function fmtUnit(v: number, unit: MoneyUnit): string {
  if (unit === 'dollars') return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (unit === 'ticks') return `${(Math.round(v * 10) / 10).toLocaleString()} ticks`
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`
}

// compact form for chart axes
export function fmtUnitAxis(v: number, unit: MoneyUnit): string {
  if (unit === 'dollars') { const a = Math.abs(v); return (v < 0 ? '-' : '') + '$' + (a >= 1000 ? (a / 1000).toFixed(1) + 'k' : String(Math.round(a))) }
  if (unit === 'ticks') return String(Math.round(v))
  return `${v.toFixed(1)}R`
}
