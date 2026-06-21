import type { Trade } from '../types'

export function getMonthTrades(trades: Trade[], year: number, month: number): Trade[] {
  return trades.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
}

export function calcNetPnl(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + t.pnl, 0)
}

export function calcWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter(t => t.pnl > 0).length
  return (wins / trades.length) * 100
}

export function calcProfitFactor(trades: Trade[]): number {
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  if (grossLoss === 0) return grossProfit > 0 ? 999 : 0
  return grossProfit / grossLoss
}

export function calcAvgRR(trades: Trade[]): number {
  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)
  if (winners.length === 0 || losers.length === 0) return 0
  const avgWin = winners.reduce((s, t) => s + t.pnl, 0) / winners.length
  const avgLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length)
  if (avgLoss === 0) return 0
  return avgWin / avgLoss
}

export function calcAverageDailyPnl(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const byDay = groupByDate(trades)
  const days = Object.keys(byDay)
  if (days.length === 0) return 0
  const total = days.reduce((s, d) => s + calcNetPnl(byDay[d]), 0)
  return total / days.length
}

export function groupByDate(trades: Trade[]): Record<string, Trade[]> {
  return trades.reduce<Record<string, Trade[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = []
    acc[t.date].push(t)
    return acc
  }, {})
}

export function getDayPnl(trades: Trade[], date: string): number {
  return trades.filter(t => t.date === date).reduce((s, t) => s + t.pnl, 0)
}

export function formatCurrency(val: number): string {
  const abs = Math.abs(val)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (val < 0 ? '-' : '') + '$' + formatted
}

export function formatPct(val: number): string {
  return val.toFixed(1) + '%'
}
