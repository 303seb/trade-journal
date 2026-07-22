import { useState, useMemo } from 'react'
import { useMobile } from '../hooks/useMobile'
import { ChevronLeft, ChevronRight, TrendingUp, BarChart2, DollarSign, Award, Activity, Target, Calendar, Zap } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts'
import type { JournalEntry, TradingAccount } from '../types'
import { formatCurrency, formatPct } from '../utils/stats'

// ── Shared chart styles ───────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px 16px',
}
const CHART_TITLE: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 16px',
  textTransform: 'uppercase', letterSpacing: '0.07em',
}
const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', borderRadius: 8, fontSize: 15, color: 'var(--text-sub)', padding: '7px 11px' },
  itemStyle: { color: 'var(--text-sub)', padding: 0 },
  labelStyle: { color: 'var(--text-muted)', fontSize: 13, marginBottom: 2 },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}
const AXIS_TICK = { fontSize: 13, fill: 'var(--text-dim)' }

const EMPTY_CHART = (
  <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 16, fontWeight: 600 }}>
    No data yet
  </div>
)

function yFmt(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`
  return `${v < 0 ? '-' : ''}$${abs}`
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, positive, icon }: {
  label: string; value: string; sub?: string; positive?: boolean | null; icon?: React.ReactNode
}) {
  const valueColor = positive === null || positive === undefined ? 'var(--text)' : positive ? '#22c55e' : '#ef4444'
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
        {icon && <div style={{ color: 'var(--text-dim)', opacity: 0.7 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: valueColor, letterSpacing: '-0.02em', marginBottom: sub ? 4 : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )
}

// ── Breakdown performance table (confluence / DOL / bias / …) ──────────────────

interface PerfRow { label: string; pnl: number; wins: number; total: number; winRate: number }

function PerfTable({ title, firstCol, data, emptyText }: {
  title: string; firstCol: string; data: PerfRow[]; emptyText: string
}) {
  return (
    <div style={CARD}>
      <p style={CHART_TITLE}>{title}</p>
      {data.length === 0 ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 16, fontWeight: 600 }}>{emptyText}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[firstCol, 'Trades', 'Wins', 'Win Rate', 'Total P&L', 'Avg P&L'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: h === firstCol ? 'left' : 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const avgPnl = row.total > 0 ? row.pnl / row.total : 0
                return (
                  <tr key={row.label} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                    <td style={{ padding: '9px 12px', color: 'var(--text)', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-sub)' }}>{row.total}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{row.wins}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: row.winRate >= 50 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{row.winRate.toFixed(1)}%</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: row.pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{row.pnl >= 0 ? '+' : ''}{formatCurrency(row.pnl)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: avgPnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{avgPnl >= 0 ? '+' : ''}{formatCurrency(avgPnl)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Analytics page ────────────────────────────────────────────────────────────

interface AnalyticsProps {
  journalEntries: JournalEntry[]
  tradingAccounts: TradingAccount[]
}

type Period = 'all' | 'year' | 'month'

export function Analytics({ journalEntries, tradingAccounts }: AnalyticsProps) {
  const isMobile = useMobile()
  const now = new Date()
  const [period, setPeriod] = useState<Period>('all')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  // Account filter: null = all (no accounts created), otherwise array of selected account names
  const [selectedAccounts, setSelectedAccounts] = useState<string[] | null>(null)

  const accountNames = tradingAccounts.map(a => a.name)
  // Initialize selected accounts when tradingAccounts first loads
  const effectiveSelected = selectedAccounts ?? accountNames

  const toggleAccount = (name: string) => {
    const current = effectiveSelected
    if (current.includes(name)) {
      setSelectedAccounts(current.filter(n => n !== name))
    } else {
      setSelectedAccounts([...current, name])
    }
  }

  const selectAll = () => setSelectedAccounts(accountNames)
  const selectNone = () => setSelectedAccounts([])

  const prevPeriod = () => {
    if (period === 'year') setYear(y => y - 1)
    else if (period === 'month') {
      if (month === 0) { setMonth(11); setYear(y => y - 1) }
      else setMonth(m => m - 1)
    }
  }
  const nextPeriod = () => {
    if (period === 'year') setYear(y => y + 1)
    else if (period === 'month') {
      if (month === 11) { setMonth(0); setYear(y => y + 1) }
      else setMonth(m => m + 1)
    }
  }

  // ── All trades flat with date (account-filtered) ──
  const allTradesFlat = useMemo(() => {
    const flat = journalEntries.flatMap(e => e.trades.map(t => ({ ...t, date: e.date })))
    // If accounts exist, filter by selected; otherwise show all
    if (accountNames.length === 0) return flat
    const sel = effectiveSelected
    if (sel.length === 0) return []
    return flat.filter(t => (t.accounts || []).some(a => sel.includes(a)) || (t.accounts || []).length === 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalEntries, effectiveSelected.join(','), accountNames.length])

  // ── Filtered trades ──
  const filteredTrades = useMemo(() => {
    if (period === 'all') return allTradesFlat
    if (period === 'year') return allTradesFlat.filter(t => t.date.startsWith(String(year)))
    return allTradesFlat.filter(t => {
      const d = new Date(t.date + 'T12:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    })
  }, [allTradesFlat, period, year, month])

  // ── Stats ──
  const netOf = (t: { pnl: string; fees?: string }) => (parseFloat(t.pnl) || 0) - (parseFloat(t.fees || '0') || 0)
  const totalPnl = filteredTrades.reduce((s, t) => s + netOf(t), 0)
  const wins = filteredTrades.filter(t => netOf(t) > 0)
  const losses = filteredTrades.filter(t => netOf(t) < 0)
  const winRate = filteredTrades.length === 0 ? 0 : (wins.length / filteredTrades.length) * 100
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + netOf(t), 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + netOf(t), 0) / losses.length) : 0
  // grossProfit / grossLoss stat cards use true gross; profitFactor uses net sums
  const grossProfit = filteredTrades.filter(t => (parseFloat(t.pnl) || 0) > 0).reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0)
  const grossLoss = Math.abs(filteredTrades.filter(t => (parseFloat(t.pnl) || 0) < 0).reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0))
  const netWinSum = wins.reduce((s, t) => s + netOf(t), 0)
  const netLossSum = Math.abs(losses.reduce((s, t) => s + netOf(t), 0))
  const profitFactor = netLossSum === 0 ? (netWinSum > 0 ? 999 : 0) : netWinSum / netLossSum

  // Best / worst day
  const dayMap = new Map<string, number>()
  filteredTrades.forEach(t => { dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + netOf(t)) })
  const dayValues = Array.from(dayMap.values())
  const bestDay = dayValues.length > 0 ? Math.max(...dayValues) : 0
  const worstDay = dayValues.length > 0 ? Math.min(...dayValues) : 0

  // Largest single win / loss
  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => netOf(t))) : 0
  const largestLoss = losses.length > 0 ? Math.abs(Math.min(...losses.map(t => netOf(t)))) : 0

  // ── Equity Curve ──
  const sorted = [...filteredTrades].sort((a, b) => {
    const dc = a.date.localeCompare(b.date)
    return dc !== 0 ? dc : (a.time || '').localeCompare(b.time || '')
  })
  let cum = 0
  const equityData = [
    { label: '0', value: 0, idx: 0 },
    ...sorted.map((t, i) => {
      cum += netOf(t)
      return { label: t.date.slice(5), value: parseFloat(cum.toFixed(2)), idx: i + 1 }
    }),
  ]
  const equityColor = equityData[equityData.length - 1]?.value >= 0 ? '#22c55e' : '#ef4444'

  // ── Monthly P&L (for year view or all time) ──
  const monthlyMap = new Map<string, number>()
  const monthlyTrades = period === 'all' ? allTradesFlat : allTradesFlat.filter(t => t.date.startsWith(String(year)))
  monthlyTrades.forEach(t => {
    const key = t.date.slice(0, 7)
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + netOf(t))
  })
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      label: `${MONTH_NAMES[parseInt(key.slice(5)) - 1]} ${key.slice(0, 4)}`,
      short: MONTH_NAMES[parseInt(key.slice(5)) - 1],
      value: parseFloat(value.toFixed(2)),
    }))

  // ── Daily P&L (for current month) ──
  const displayYear = period === 'all' ? now.getFullYear() : year
  const displayMonth = period === 'all' ? now.getMonth() : month
  const dailyMap = new Map<string, number>()
  allTradesFlat.filter(t => {
    const d = new Date(t.date + 'T12:00:00')
    return d.getFullYear() === displayYear && d.getMonth() === displayMonth
  }).forEach(t => {
    dailyMap.set(t.date, (dailyMap.get(t.date) ?? 0) + netOf(t))
  })
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ label: date.slice(8).replace(/^0/, ''), value: parseFloat(value.toFixed(2)) }))

  // ── P&L by Symbol ──
  const symbolMap = new Map<string, number>()
  filteredTrades.forEach(t => {
    if (!t.symbol) return
    symbolMap.set(t.symbol, (symbolMap.get(t.symbol) ?? 0) + netOf(t))
  })
  const symbolData = Array.from(symbolMap.entries())
    .map(([label, value]) => ({ label, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  // ── P&L by Session ──
  const sessionMap = new Map<string, number>()
  filteredTrades.forEach(t => {
    const sessions = (t.sessions || []).length > 0 ? t.sessions : ['Other']
    sessions.forEach(s => { sessionMap.set(s, (sessionMap.get(s) ?? 0) + netOf(t)) })
  })
  const sessionData = Array.from(sessionMap.entries())
    .map(([label, value]) => ({ label, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  // ── Session Performance (detailed) ──
  const sessionPerfMap = new Map<string, { pnl: number; wins: number; losses: number; total: number }>()
  filteredTrades.forEach(t => {
    const sessions = (t.sessions || []).length > 0 ? t.sessions : ['Other']
    const pnl = netOf(t)
    sessions.forEach(s => {
      const cur = sessionPerfMap.get(s) ?? { pnl: 0, wins: 0, losses: 0, total: 0 }
      sessionPerfMap.set(s, { pnl: cur.pnl + pnl, wins: cur.wins + (pnl > 0 ? 1 : 0), losses: cur.losses + (pnl < 0 ? 1 : 0), total: cur.total + 1 })
    })
  })
  const sessionPerfData = Array.from(sessionPerfMap.entries())
    .map(([label, d]) => ({ label, pnl: parseFloat(d.pnl.toFixed(2)), wins: d.wins, losses: d.losses, total: d.total, winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)

  // ── Breakdown builder: one row per key, a trade can contribute to many keys ──
  const buildPerf = (getKeys: (t: typeof filteredTrades[number]) => string[]): PerfRow[] => {
    const m = new Map<string, { pnl: number; wins: number; total: number }>()
    filteredTrades.forEach(t => {
      const pnl = netOf(t)
      const keys = Array.from(new Set(getKeys(t).filter(Boolean)))
      keys.forEach(k => {
        const cur = m.get(k) ?? { pnl: 0, wins: 0, total: 0 }
        m.set(k, { pnl: cur.pnl + pnl, wins: cur.wins + (pnl > 0 ? 1 : 0), total: cur.total + 1 })
      })
    })
    return Array.from(m.entries())
      .map(([label, d]) => ({ label, pnl: parseFloat(d.pnl.toFixed(2)), wins: d.wins, total: d.total, winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
  }

  // ── Confluence Performance (across every ICT confluence field on the trade) ──
  const CONFLUENCE_FIELDS = ['confluences', 'smtPresent', 'cisdPresent', 'fvgPresent', 'ifvgPresent', 'rejectionBlock', 'otePresent', 'stdvPresent', 'orderBlock', 'bprPresent', 'internalRangeLiquidity', 'externalRangeLiquidity', 'liquiditySwept'] as const
  const confluencePerfData = buildPerf(t => CONFLUENCE_FIELDS.flatMap(f => (t[f] as string[] | undefined) || []))

  // ── DOL Performance (Draw on Liquidity) ──
  const dolPerfData = buildPerf(t => t.dol || [])

  // ── Bias Performance (HTF Bias) ──
  const biasPerfData = buildPerf(t => (t.htfBias ? [t.htfBias] : []))

  // ── R Multiple Distribution ──
  const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }
  const RR_BUCKETS = ['<0R', '0–1R', '1–2R', '2–3R', '3R+']
  const rrBucketMap = new Map<string, { trades: number; wins: number; totalR: number }>(
    RR_BUCKETS.map(b => [b, { trades: 0, wins: 0, totalR: 0 }])
  )
  filteredTrades.forEach(t => {
    const pv = PVMAP[t.symbol] ?? 0
    const sl = parseFloat(t.stopLoss), c = parseFloat(t.contracts), pnl = netOf(t)
    if (!pv || isNaN(sl) || isNaN(c) || c <= 0 || sl === 0) return
    const risk = sl * pv * c
    if (risk === 0) return
    const r = pnl / risk
    let bucket = r < 0 ? '<0R' : r < 1 ? '0–1R' : r < 2 ? '1–2R' : r < 3 ? '2–3R' : '3R+'
    const cur = rrBucketMap.get(bucket)!
    rrBucketMap.set(bucket, { trades: cur.trades + 1, wins: cur.wins + (pnl > 0 ? 1 : 0), totalR: cur.totalR + r })
  })
  const rrDistData = RR_BUCKETS.map(b => {
    const d = rrBucketMap.get(b)!
    return { label: b, trades: d.trades, wins: d.wins, winRate: d.trades > 0 ? parseFloat(((d.wins / d.trades) * 100).toFixed(1)) : 0, avgR: d.trades > 0 ? parseFloat((d.totalR / d.trades).toFixed(2)) : 0 }
  })

  // ── Win Rate by Symbol ──
  const symWinMap = new Map<string, { wins: number; total: number }>()
  filteredTrades.forEach(t => {
    if (!t.symbol) return
    const cur = symWinMap.get(t.symbol) ?? { wins: 0, total: 0 }
    symWinMap.set(t.symbol, { wins: cur.wins + (netOf(t) > 0 ? 1 : 0), total: cur.total + 1 })
  })
  const symWinData = Array.from(symWinMap.entries())
    .map(([label, { wins: w, total }]) => ({ label, value: total > 0 ? parseFloat(((w / total) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.value - a.value)

  // ── Trade count by day of week ──
  const dowMap = new Map<number, { count: number; pnl: number }>()
  for (let i = 0; i < 7; i++) dowMap.set(i, { count: 0, pnl: 0 })
  filteredTrades.forEach(t => {
    const dow = new Date(t.date + 'T12:00:00').getDay()
    const cur = dowMap.get(dow)!
    dowMap.set(dow, { count: cur.count + 1, pnl: cur.pnl + netOf(t) })
  })
  const dowData = [1, 2, 3, 4, 5].map(i => ({
    label: DOW[i],
    count: dowMap.get(i)?.count ?? 0,
    pnl: parseFloat((dowMap.get(i)?.pnl ?? 0).toFixed(2)),
  }))

  // ── P&L by result ──
  const resultMap = new Map<string, number>()
  filteredTrades.forEach(t => { resultMap.set(t.result, (resultMap.get(t.result) ?? 0) + 1) })
  const resultData = Array.from(resultMap.entries()).map(([label, value]) => ({ label, value }))

  // ── R:R running average ──
  let cumR = 0, rrCount = 0
  const rrData: { label: string; value: number }[] = [{ label: '0', value: 0 }]
  sorted.forEach(t => {
    const pv = PVMAP[t.symbol] ?? 0
    const sl = parseFloat(t.stopLoss), c = parseFloat(t.contracts)
    if (!pv || isNaN(sl) || isNaN(c) || c <= 0 || sl === 0) return
    const risk = sl * pv * c
    if (risk === 0) return
    cumR += netOf(t) / risk
    rrCount++
    rrData.push({ label: String(rrCount), value: parseFloat(cumR.toFixed(2)) })
  })
  const avgR = rrCount > 0 ? parseFloat((cumR / rrCount).toFixed(2)) : null
  const rrColor = rrData[rrData.length - 1]?.value >= 0 ? '#22c55e' : '#ef4444'

  // ── Per-account stats ──
  const accountStats = tradingAccounts.map(acc => {
    const accTrades = allTradesFlat.filter(t => (t.accounts || []).includes(acc.name))
    const accPnl = accTrades.reduce((s, t) => s + netOf(t), 0)
    const accWins = accTrades.filter(t => netOf(t) > 0).length
    const accWr = accTrades.length > 0 ? (accWins / accTrades.length) * 100 : 0
    return { acc, pnl: accPnl, trades: accTrades.length, winRate: accWr }
  })

  // ── Period label ──
  const periodLabel = period === 'all' ? 'All Time'
    : period === 'year' ? String(year)
    : `${MONTH_NAMES[month]} ${year}`

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: isMobile ? '14px 12px 32px' : '28px 32px 52px', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Analytics</h1>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', margin: 0 }}>Deep dive into your trading performance.</p>
          </div>

          {/* Period controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Period tabs */}
            <div style={{ display: 'flex', gap: 3, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 3 }}>
              {(['all', 'year', 'month'] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: period === p ? 'var(--btn-bg)' : 'transparent',
                  color: period === p ? 'var(--btn-text)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>{p === 'all' ? 'All Time' : p === 'year' ? 'Year' : 'Month'}</button>
              ))}
            </div>

            {/* Nav arrows (only for year/month) */}
            {period !== 'all' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={prevPeriod} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                ><ChevronLeft size={14} /></button>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-sub)', minWidth: 100, textAlign: 'center' }}>{periodLabel}</span>
                <button onClick={nextPeriod} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                ><ChevronRight size={14} /></button>
              </div>
            )}
            {period === 'all' && <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dim)' }}>All Time</span>}
          </div>
        </div>

        {/* ── Account filter (only shown when accounts exist) ── */}
        {accountNames.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '14px 18px', borderRadius: 14,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', whiteSpace: 'nowrap' }}>Accounts</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {accountNames.map(name => {
                const active = effectiveSelected.includes(name)
                const acc = tradingAccounts.find(a => a.name === name)
                const typeColor = acc?.type === 'Live' ? '#22c55e' : acc?.type === 'Eval' ? '#fbbf24' : '#60a5fa'
                return (
                  <button
                    key={name}
                    onClick={() => toggleAccount(name)}
                    style={{
                      padding: '5px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                      border: `1px solid ${active ? typeColor + '55' : 'var(--border-mid)'}`,
                      background: active ? typeColor + '14' : 'transparent',
                      color: active ? typeColor : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-sub)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                  >{name}</button>
                )
              })}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={selectAll} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-sub)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >All</button>
              <button onClick={selectNone} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-sub)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >None</button>
            </div>
          </div>
        )}

        {/* ── Stats row 1 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Total P&L" value={filteredTrades.length === 0 ? '—' : (totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl)}
            sub={`${filteredTrades.length} trade${filteredTrades.length !== 1 ? 's' : ''}`}
            positive={filteredTrades.length === 0 ? null : totalPnl >= 0} icon={<DollarSign size={15} />} />
          <StatCard label="Win Rate" value={filteredTrades.length === 0 ? '—' : formatPct(winRate)}
            sub={`${wins.length}W / ${losses.length}L`}
            positive={filteredTrades.length === 0 ? null : winRate >= 50} icon={<Award size={15} />} />
          <StatCard label="Profit Factor" value={filteredTrades.length === 0 ? '—' : profitFactor >= 999 ? '∞' : profitFactor.toFixed(2)}
            sub={profitFactor >= 1 ? 'Profitable' : filteredTrades.length === 0 ? '' : 'Unprofitable'}
            positive={filteredTrades.length === 0 ? null : profitFactor >= 1} icon={<BarChart2 size={15} />} />
          <StatCard label="Avg R" value={avgR === null ? '—' : `${avgR}R`}
            sub="per trade" positive={avgR === null ? null : avgR >= 0}
            icon={<TrendingUp size={15} />} />
        </div>

        {/* ── Stats row 2 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Best Day" value={bestDay === 0 && dayValues.length === 0 ? '—' : (bestDay >= 0 ? '+' : '') + formatCurrency(bestDay)}
            positive={dayValues.length === 0 ? null : true} icon={<Zap size={15} />} />
          <StatCard label="Worst Day" value={worstDay === 0 && dayValues.length === 0 ? '—' : (worstDay >= 0 ? '+' : '') + formatCurrency(worstDay)}
            positive={dayValues.length === 0 ? null : worstDay >= 0} icon={<Activity size={15} />} />
          <StatCard label="Avg Win" value={avgWin === 0 ? '—' : '+' + formatCurrency(avgWin)}
            sub={wins.length > 0 ? `${wins.length} winning trades` : ''}
            positive={avgWin === 0 ? null : true} icon={<Target size={15} />} />
          <StatCard label="Avg Loss" value={avgLoss === 0 ? '—' : '-' + formatCurrency(avgLoss)}
            sub={losses.length > 0 ? `${losses.length} losing trades` : ''}
            positive={avgLoss === 0 ? null : false} icon={<Calendar size={15} />} />
        </div>

        {/* ── Additional stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Largest Win" value={largestWin === 0 ? '—' : '+' + formatCurrency(largestWin)} positive={largestWin === 0 ? null : true} icon={<TrendingUp size={15} />} />
          <StatCard label="Largest Loss" value={largestLoss === 0 ? '—' : '-' + formatCurrency(largestLoss)} positive={largestLoss === 0 ? null : false} icon={<Activity size={15} />} />
          <StatCard label="Gross Profit" value={grossProfit === 0 ? '—' : '+' + formatCurrency(grossProfit)} positive={grossProfit === 0 ? null : true} icon={<DollarSign size={15} />} />
          <StatCard label="Gross Loss" value={grossLoss === 0 ? '—' : '-' + formatCurrency(grossLoss)} positive={grossLoss === 0 ? null : false} icon={<DollarSign size={15} />} />
        </div>

        {/* ── Equity Curve (full width) ── */}
        <div style={CARD}>
          <p style={CHART_TITLE}>Equity Curve</p>
          {equityData.length < 2 ? EMPTY_CHART : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={equityData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={60} />
                <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="3 3" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatCurrency(Number(v)), 'Equity']} />
                <Line type="monotone" dataKey="value" stroke={equityColor} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Cumulative R:R (full width) ── */}
        <div style={CARD}>
          <p style={CHART_TITLE}>Cumulative R (per trade)</p>
          {rrData.length < 2 ? EMPTY_CHART : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={rrData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `${v}R`} width={50} />
                <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="3 3" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`${Number(v)}R`, 'Cum. R']} />
                <Line type="monotone" dataKey="value" stroke={rrColor} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Monthly P&L + Daily P&L ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={CARD}>
            <p style={CHART_TITLE}>Monthly P&L</p>
            {monthlyData.length === 0 ? EMPTY_CHART : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="short" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={56} />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatCurrency(Number(v)), 'P&L']} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {monthlyData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={CARD}>
            <p style={CHART_TITLE}>Daily P&L — {MONTH_NAMES[displayMonth]} {displayYear}</p>
            {dailyData.length === 0 ? EMPTY_CHART : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={56} />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatCurrency(Number(v)), 'P&L']} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {dailyData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── P&L by Symbol + P&L by Session ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={CARD}>
            <p style={CHART_TITLE}>P&L by Symbol</p>
            {symbolData.length === 0 ? EMPTY_CHART : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={symbolData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={60} />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatCurrency(Number(v)), 'P&L']} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {symbolData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={CARD}>
            <p style={CHART_TITLE}>P&L by Session</p>
            {sessionData.length === 0 ? EMPTY_CHART : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sessionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={60} />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatCurrency(Number(v)), 'P&L']} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {sessionData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Session Performance Table ── */}
        <div style={CARD}>
          <p style={CHART_TITLE}>Session Performance</p>
          {sessionPerfData.length === 0 ? EMPTY_CHART : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Session', 'Trades', 'Wins', 'Losses', 'Win Rate', 'Total P&L', 'Avg P&L'].map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: h === 'Session' ? 'left' : 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessionPerfData.map((row, i) => {
                    const avgPnl = row.total > 0 ? row.pnl / row.total : 0
                    return (
                      <tr key={row.label} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                        <td style={{ padding: '9px 12px', color: 'var(--text)', fontWeight: 600 }}>{row.label}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-sub)' }}>{row.total}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{row.wins}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{row.losses}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: row.winRate >= 50 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{row.winRate.toFixed(1)}%</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: row.pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{row.pnl >= 0 ? '+' : ''}{formatCurrency(row.pnl)}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: avgPnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{avgPnl >= 0 ? '+' : ''}{formatCurrency(avgPnl)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Confluence Performance Table ── */}
        <PerfTable title="Confluence Performance" firstCol="Confluence" data={confluencePerfData} emptyText="No confluence data yet" />

        {/* ── DOL Performance Table ── */}
        <PerfTable title="DOL Performance" firstCol="Draw on Liquidity" data={dolPerfData} emptyText="No DOL data yet" />

        {/* ── Bias Performance Table ── */}
        <PerfTable title="Bias Performance" firstCol="HTF Bias" data={biasPerfData} emptyText="No bias data yet" />

        {/* ── R Multiple Distribution ── */}
        <div style={CARD}>
          <p style={CHART_TITLE}>R Multiple Distribution</p>
          {rrDistData.every(d => d.trades === 0) ? EMPTY_CHART : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rrDistData.map(d => {
                const maxTrades = Math.max(...rrDistData.map(x => x.trades), 1)
                const barColor = d.label === '<0R' ? '#ef4444' : d.label === '0–1R' ? '#fbbf24' : '#22c55e'
                return (
                  <div key={d.label}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-sub)', width: 52, flexShrink: 0 }}>{d.label}</span>
                      <div style={{ flex: 1, height: 20, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(d.trades / maxTrades) * 100}%`, height: '100%', background: barColor, opacity: 0.75, borderRadius: 4, minWidth: d.trades > 0 ? 4 : 0, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', width: 24, textAlign: 'right', flexShrink: 0 }}>{d.trades}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: d.winRate >= 50 ? '#22c55e' : d.winRate > 0 ? '#ef4444' : 'var(--text-dim)', width: 50, textAlign: 'right', flexShrink: 0 }}>{d.trades > 0 ? `${d.winRate}%` : '—'}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', width: 60, textAlign: 'right', flexShrink: 0 }}>{d.trades > 0 ? `avg ${d.avgR}R` : ''}</span>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 20, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Bar = trade count · % = win rate in bucket · avg = average R multiple</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Win Rate by Symbol + P&L by Day of Week ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={CARD}>
            <p style={CHART_TITLE}>Win Rate by Symbol</p>
            {symWinData.length === 0 ? EMPTY_CHART : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={symWinData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={50} domain={[0, 100]} />
                  <ReferenceLine y={50} stroke="#333" strokeDasharray="3 3" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`${Number(v)}%`, 'Win Rate']} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {symWinData.map((d, i) => <Cell key={i} fill={d.value >= 50 ? '#22c55e' : '#ef4444'} fillOpacity={0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={CARD}>
            <p style={CHART_TITLE}>P&L by Day of Week</p>
            {dowData.every(d => d.pnl === 0) ? EMPTY_CHART : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={60} />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [formatCurrency(Number(v)), 'P&L']} />
                  <Bar dataKey="pnl" name="pnl" radius={[3, 3, 0, 0]}>
                    {dowData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Trade Count by Day of Week + Result Distribution ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={CARD}>
            <p style={CHART_TITLE}>Trade Volume by Day of Week</p>
            {dowData.every(d => d.count === 0) ? EMPTY_CHART : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v), 'Trades']} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="#60a5fa" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={CARD}>
            <p style={CHART_TITLE}>Result Distribution</p>
            {resultData.length === 0 ? EMPTY_CHART : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
                {[
                  { key: 'Win', color: '#22c55e' }, { key: 'Loss', color: '#ef4444' },
                  { key: 'BE', color: '#888' }, { key: "Didn't take", color: '#fb923c' },
                ].map(({ key, color }) => {
                  const count = resultMap.get(key) ?? 0
                  const total = filteredTrades.length
                  const pct = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 15, color: 'var(--text-sub)', fontWeight: 600 }}>{key}</span>
                        <span style={{ fontSize: 15, color: 'var(--text-sub)' }}>{count} <span style={{ color: 'var(--text-dim)' }}>({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, opacity: 0.75 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Account Balances ── */}
        {tradingAccounts.length > 0 && (
          <div style={CARD}>
            <p style={CHART_TITLE}>Account Performance</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {accountStats.map(({ acc, pnl, trades, winRate: wr }) => {
                const pnlColor = pnl > 0 ? '#22c55e' : pnl < 0 ? '#ef4444' : '#777'
                const typeColors: Record<string, string> = { Live: '#22c55e', Eval: '#fbbf24', Funded: '#60a5fa' }
                const tc = typeColors[acc.type] || 'var(--text-sub)'
                return (
                  <div key={acc.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: tc }} />
                      <span style={{ fontSize: 13, color: tc, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{acc.type}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginLeft: 2 }}>{acc.name}</span>
                    </div>
                    {acc.type === 'Live' && (
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>{acc.broker || 'No broker set'}</div>
                    )}
                    {(acc.type === 'Eval' || acc.type === 'Funded') && (
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>{acc.propFirm || '—'} · {formatCurrency(acc.size)}</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>P&L</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: pnlColor }}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Trades</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-sub)' }}>{trades}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Win %</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: wr >= 50 ? '#22c55e' : '#ef4444' }}>{trades > 0 ? formatPct(wr) : '—'}</div>
                      </div>
                    </div>
                    {acc.type === 'Eval' && acc.profitTarget > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Target progress</span>
                          <span style={{ fontSize: 13, color: pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{Math.round((pnl / acc.profitTarget) * 100)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, (pnl / acc.profitTarget) * 100))}%`, height: '100%', background: '#fbbf24', borderRadius: 999 }} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
