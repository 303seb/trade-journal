import type { JournalEntry, DashTrade, TradeLog } from '../types'

const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }

// Number of accounts a trade's P&L should be summed across (copy trading).
export function copyMultiplier(t: Pick<TradeLog, 'copyTraded' | 'copyTradedAccounts'>): number {
  return t.copyTraded === 'Yes' && (t.copyTradedAccounts?.length ?? 0) > 0 ? (t.copyTradedAccounts as string[]).length : 1
}

// Per-account gross P&L derived from prices (single account, no copy multiplier).
function baseTradePnl(t: TradeLog): string {
  const pv = PVMAP[t.symbol]
  if (!pv) return ''
  const e = parseFloat(t.entryPrice)
  if (isNaN(e) || e === 0) return ''
  if (t.exitPartials && t.exitPartials.length > 0) {
    let total = 0
    let any = false
    for (const p of t.exitPartials) {
      const price = parseFloat(p.price), qty = parseFloat(p.qty)
      if (isNaN(price) || isNaN(qty) || qty <= 0) continue
      any = true
      total += (t.side === 'Long' ? price - e : e - price) * pv * qty
    }
    return any ? total.toFixed(2) : ''
  }
  const x = parseFloat(t.exitPrice), c = parseFloat(t.contracts)
  if (isNaN(x) || isNaN(c) || c <= 0 || x === 0) return ''
  return ((t.side === 'Long' ? x - e : e - x) * pv * c).toFixed(2)
}

// Recompute each trade's stored gross P&L = per-account base × number of copied accounts,
// so copy-traded trades sum correctly everywhere (calendar, stats, popups). Idempotent;
// leaves a trade's stored P&L untouched when it can't be derived from prices.
export function normalizeJournalEntries(entries: JournalEntry[]): JournalEntry[] {
  return entries.map(entry => ({
    ...entry,
    trades: entry.trades.map(t => {
      const base = baseTradePnl(t)
      return base === '' ? t : { ...t, pnl: (parseFloat(base) * copyMultiplier(t)).toFixed(2) }
    }),
  }))
}

export function getDashTrades(entries: JournalEntry[]): DashTrade[] {
  return entries.flatMap(entry =>
    entry.trades.map(t => ({
      id: t.id,
      date: entry.date,
      pnl: (parseFloat(t.pnl) || 0) - (parseFloat(t.fees || '0') || 0),
      result: t.result,
      symbol: t.symbol || '',
      side: (t.side || 'Long') as 'Long' | 'Short',
    }))
  )
}

export function getMonthTrades(trades: DashTrade[], year: number, month: number): DashTrade[] {
  return trades.filter(t => {
    const d = new Date(t.date + 'T12:00:00')
    return d.getFullYear() === year && d.getMonth() === month
  })
}

export function getYearTrades(trades: DashTrade[], year: number): DashTrade[] {
  return trades.filter(t => new Date(t.date + 'T12:00:00').getFullYear() === year)
}

export function calcNetPnl(trades: DashTrade[]): number {
  return trades.reduce((sum, t) => sum + t.pnl, 0)
}

export function calcWinRate(trades: DashTrade[]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter(t => t.pnl > 0).length
  return (wins / trades.length) * 100
}

export function calcProfitFactor(trades: DashTrade[]): number {
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  if (grossLoss === 0) return grossProfit > 0 ? 999 : 0
  return grossProfit / grossLoss
}

export function calcAvgRR(trades: DashTrade[]): number {
  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)
  if (winners.length === 0 || losers.length === 0) return 0
  const avgWin = winners.reduce((s, t) => s + t.pnl, 0) / winners.length
  const avgLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length)
  if (avgLoss === 0) return 0
  return avgWin / avgLoss
}

export function getDayPnl(trades: DashTrade[], date: string): number {
  return trades.filter(t => t.date === date).reduce((s, t) => s + t.pnl, 0)
}

export function hasDayTrades(trades: DashTrade[], date: string): boolean {
  return trades.some(t => t.date === date)
}

export function formatCurrency(val: number): string {
  const abs = Math.abs(val)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (val < 0 ? '-' : '') + '$' + formatted
}

export function formatPct(val: number): string {
  return val.toFixed(1) + '%'
}
