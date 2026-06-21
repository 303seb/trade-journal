import type { JournalEntry, DashTrade } from '../types'

export function getDashTrades(entries: JournalEntry[]): DashTrade[] {
  return entries.flatMap(entry =>
    entry.trades
      .filter(t => t.result !== "Didn't take")
      .map(t => ({
        id: t.id,
        date: entry.date,
        pnl: parseFloat(t.pnl) || 0,
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
