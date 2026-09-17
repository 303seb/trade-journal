import { useState, useMemo } from 'react'
import { useMobile } from '../hooks/useMobile'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { NotebookPen, Zap, Info } from 'lucide-react'
import { MonthCalendar } from '../components/MonthCalendar'
import { QuickAddModal } from '../components/QuickAddModal'
import { ControlBar, DEFAULT_CONTROLS } from '../components/ControlBar'
import type { Controls } from '../components/ControlBar'
import { tradeUnitValue, fmtUnit, fmtUnitAxis } from '../utils/units'
import { getDashTrades, formatCurrency } from '../utils/stats'
import type { JournalEntry, TradingRule, TradeLog, TradingAccount } from '../types'

interface DashboardProps {
  journalEntries: JournalEntry[]
  monthlyGoals: { month: string; amount: number }[]
  tradingRules: TradingRule[]
  tradingAccounts: TradingAccount[]
  onSetGoal: (month: string, amount: number) => void
  onNavigateToJournal: (date?: string) => void
  onNavigateToDiary?: (date: string) => void
  onQuickAddTrade: (trade: TradeLog, date: string) => void
  diaryDates?: string[]
}

// ── helpers ────────────────────────────────────────────────────────────────────
const netOf = (t: { pnl: string; fees?: string }) => (parseFloat(t.pnl) || 0) - (parseFloat(t.fees || '0') || 0)
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const GREEN = '#22c55e', RED = '#ef4444'

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', borderRadius: 8, fontSize: 13, color: 'var(--text-sub)', padding: '6px 10px' },
  itemStyle: { color: 'var(--text-sub)', padding: 0 },
  labelStyle: { color: 'var(--text-muted)', fontSize: 12, marginBottom: 2 },
}

const CARD: React.CSSProperties = {
  background: 'var(--card-sheen), var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 16, padding: '16px 18px 14px', boxShadow: 'var(--shadow-card)',
}
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }

function CardHead({ title }: { title: string }) {
  return <div style={{ ...cardTitle, marginBottom: 14 }}>{title}<Info size={13} style={{ opacity: 0.4 }} /></div>
}

// Small SVG donut for the KPI cards
function Donut({ segments, size = 62, thickness = 9, center }: { segments: { value: number; color: string }[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          offset += len
          return el
        })}
      </svg>
      {center && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{center}</div>}
    </div>
  )
}

function KpiCard({ label, value, valueColor, right, footer }: { label: string; value: string; valueColor?: string; right?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div style={{ ...CARD, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 118 }}>
      <div style={{ ...cardTitle, fontSize: 13 }}>{label}<Info size={12} style={{ opacity: 0.4 }} /></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: valueColor || 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
          {footer}
        </div>
        {right}
      </div>
    </div>
  )
}

export function Dashboard({ journalEntries, tradingRules, tradingAccounts, onNavigateToJournal, onNavigateToDiary, onQuickAddTrade, diaryDates }: DashboardProps) {
  const isMobile = useMobile()
  const now = new Date()
  const todayIso = iso(now)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [showQuick, setShowQuick] = useState(false)
  const [tradesTab, setTradesTab] = useState<'recent' | 'open'>('recent')
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS)
  const unit = controls.unit

  const accountNames = tradingAccounts.map(a => a.name)
  const symbols = useMemo(() => Array.from(new Set(journalEntries.flatMap(e => e.trades.map(t => t.symbol).filter(Boolean)))).sort(), [journalEntries])

  // account-filtered entries (used by the calendar)
  const acctEntries = useMemo(() => {
    if (controls.account === 'all') return journalEntries
    return journalEntries.map(e => ({ ...e, trades: e.trades.filter(t => (t.accounts || []).includes(controls.account) || (t.accounts || []).length === 0) }))
  }, [journalEntries, controls.account])

  // flat, account + range + filters
  const trades = useMemo(() => {
    let flat = acctEntries.flatMap(e => e.trades.map(t => ({ ...t, date: e.date })))
    if (controls.range === 'ytd') flat = flat.filter(t => t.date.startsWith(String(now.getFullYear())))
    else if (controls.range === 'month') flat = flat.filter(t => t.date.startsWith(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`))
    else if (controls.range === '30d') {
      const cut = new Date(); cut.setDate(cut.getDate() - 30); const c = iso(cut)
      flat = flat.filter(t => t.date >= c)
    }
    if (controls.result !== 'all') flat = flat.filter(t => t.result === controls.result)
    if (controls.symbol !== 'all') flat = flat.filter(t => t.symbol === controls.symbol)
    return flat
  }, [acctEntries, controls.range, controls.result, controls.symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── core metrics ── (magnitudes in the selected unit; win/loss by $ outcome)
  const m = useMemo(() => {
    const uv = (t: typeof trades[number]) => tradeUnitValue(t, unit)
    const netPnl = trades.reduce((s, t) => s + uv(t), 0)
    const wins = trades.filter(t => netOf(t) > 0)
    const losses = trades.filter(t => netOf(t) < 0)
    const bes = trades.filter(t => netOf(t) === 0 && t.pnl !== '')
    const decided = wins.length + losses.length
    const tradeWin = decided > 0 ? (wins.length / decided) * 100 : 0
    // profit factor + avg win/loss stay in $ (ratios / dollar figures)
    const grossProfit = wins.reduce((s, t) => s + netOf(t), 0)
    const grossLoss = Math.abs(losses.reduce((s, t) => s + netOf(t), 0))
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss
    const avgWin = wins.length ? grossProfit / wins.length : 0
    const avgLoss = losses.length ? grossLoss / losses.length : 0
    const wlRatio = avgLoss === 0 ? (avgWin > 0 ? Infinity : 0) : avgWin / avgLoss

    // per-day: $ map for win/loss classification, unit map for bars
    const dayDollar = new Map<string, number>()
    const dayUnit = new Map<string, number>()
    trades.forEach(t => {
      dayDollar.set(t.date, (dayDollar.get(t.date) ?? 0) + netOf(t))
      dayUnit.set(t.date, (dayUnit.get(t.date) ?? 0) + uv(t))
    })
    const days = [...dayDollar.entries()]
    const winDays = days.filter(([, v]) => v > 0).length
    const lossDays = days.filter(([, v]) => v < 0).length
    const beDays = days.filter(([, v]) => v === 0).length
    const dayWin = (winDays + lossDays) > 0 ? (winDays / (winDays + lossDays)) * 100 : 0

    // equity + drawdown (unit for display, $ for the stable score)
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    let cum = 0, peak = 0, maxDD = 0
    let cumD = 0, peakD = 0, maxDDd = 0
    const equity: { i: number; label: string; value: number; dd: number }[] = [{ i: 0, label: '', value: 0, dd: 0 }]
    sorted.forEach((t, i) => {
      cum += uv(t); peak = Math.max(peak, cum)
      const dd = cum - peak; maxDD = Math.min(maxDD, dd)
      cumD += netOf(t); peakD = Math.max(peakD, cumD); maxDDd = Math.min(maxDDd, cumD - peakD)
      equity.push({ i: i + 1, label: t.date.slice(5), value: +cum.toFixed(2), dd: +dd.toFixed(2) })
    })
    const maxDrawdown = Math.abs(maxDD)
    const maxDrawdownD = Math.abs(maxDDd)
    const netPnlD = grossProfit - grossLoss
    const recovery = maxDrawdownD > 0 ? netPnlD / maxDrawdownD : (netPnlD > 0 ? 3 : 0)
    const consistency = days.length ? (winDays / days.length) * 100 : 0

    // daily bars (unit)
    const dailyBars = [...dayUnit.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ label: d.slice(5), value: +v.toFixed(2) }))

    return { netPnl, netPnlD, wins: wins.length, losses: losses.length, bes: bes.length, tradeWin, profitFactor, avgWin, avgLoss, wlRatio, winDays, lossDays, beDays, dayWin, equity, maxDrawdown, maxDrawdownD, recovery, consistency, dailyBars, count: trades.length }
  }, [trades, unit])

  // ── performance score (original composite, 0–100) ──
  const score = useMemo(() => {
    const winScore = clamp(m.tradeWin, 0, 100)
    const pfScore = m.profitFactor === Infinity ? 100 : clamp((m.profitFactor / 3) * 100, 0, 100)
    const wlScore = m.wlRatio === Infinity ? 100 : clamp((m.wlRatio / 3) * 100, 0, 100)
    const recScore = clamp((m.recovery / 3) * 100, 0, 100)
    const ddScore = m.maxDrawdownD === 0 ? 100 : clamp(100 - (m.maxDrawdownD / (m.maxDrawdownD + Math.max(m.netPnlD, 0) + 1)) * 100, 0, 100)
    const consScore = clamp(m.consistency, 0, 100)
    const radar = [
      { metric: 'Win %', value: +winScore.toFixed(0) },
      { metric: 'Profit factor', value: +pfScore.toFixed(0) },
      { metric: 'Avg win/loss', value: +wlScore.toFixed(0) },
      { metric: 'Recovery', value: +recScore.toFixed(0) },
      { metric: 'Max drawdown', value: +ddScore.toFixed(0) },
      { metric: 'Consistency', value: +consScore.toFixed(0) },
    ]
    const composite = radar.reduce((s, r) => s + r.value, 0) / radar.length
    return { radar, composite }
  }, [m])

  // ── account balance series ──
  const balanceSeries = useMemo(() => {
    const base = tradingAccounts.reduce((s, a) => {
      if (a.type === 'Live') return s + (a.balance || 0)
      if (a.type === 'Eval') return s + (a.startingBalance ?? a.size ?? 0)
      return s + (a.size ?? 0)
    }, 0)
    let cum = base
    const out = [{ label: '', value: base }]
    const dayMap = new Map<string, number>()
    trades.forEach(t => dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + netOf(t)))
    ;[...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([d, v]) => { cum += v; out.push({ label: d.slice(5), value: +cum.toFixed(2) }) })
    return { base, out }
  }, [trades, tradingAccounts])

  // ── trade time performance scatter ──
  const timePoints = useMemo(() => trades.filter(t => t.time).map(t => {
    const [h, min] = (t.time || '0:0').split(':').map(Number)
    return { hour: (h || 0) + (min || 0) / 60, pnl: +tradeUnitValue(t, unit).toFixed(2), sign: netOf(t) }
  }), [trades, unit])

  // ── progress heatmap (last ~18 weeks) ──
  const heatmap = useMemo(() => {
    const weeksBack = isMobile ? 12 : 20
    const end = new Date(now); end.setDate(end.getDate() + (6 - end.getDay())) // end of this week (Sat)
    const start = new Date(end); start.setDate(start.getDate() - (weeksBack * 7 - 1))
    const dayMap = new Map<string, { pnl: number; count: number }>()
    trades.forEach(t => { const cur = dayMap.get(t.date) ?? { pnl: 0, count: 0 }; dayMap.set(t.date, { pnl: cur.pnl + netOf(t), count: cur.count + 1 }) })
    const cols: { key: string; count: number; pnl: number; inFuture: boolean; monthLabel?: string }[][] = []
    const cursor = new Date(start)
    let lastMonth = -1
    for (let w = 0; w < weeksBack; w++) {
      const col: { key: string; count: number; pnl: number; inFuture: boolean; monthLabel?: string }[] = []
      for (let d = 0; d < 7; d++) {
        const key = iso(cursor)
        const data = dayMap.get(key)
        const monthOfFirst = cursor.getMonth()
        col.push({ key, count: data?.count ?? 0, pnl: data?.pnl ?? 0, inFuture: key > todayIso, monthLabel: d === 0 && monthOfFirst !== lastMonth ? cursor.toLocaleDateString('en-US', { month: 'short' }) : undefined })
        if (d === 0) lastMonth = monthOfFirst
        cursor.setDate(cursor.getDate() + 1)
      }
      cols.push(col)
    }
    return cols
  }, [trades, isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── today's checklist ──
  const todayEntry = journalEntries.find(e => e.date === todayIso)
  const loggedToday = !!todayEntry && todayEntry.trades.length > 0
  const journaledToday = (diaryDates?.includes(todayIso) ?? false) || !!(todayEntry && (todayEntry.postMarketNotes || todayEntry.premktAnalysis))
  const checklist = [
    { label: 'Log a trade', done: loggedToday },
    { label: 'Write daily journal', done: journaledToday },
  ]
  const checkScore = checklist.filter(c => c.done).length

  // ── recent trades ──
  const recent = useMemo(() => [...trades].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '')).slice(0, 8), [trades])

  const allTrades = getDashTrades(acctEntries)
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const pfText = m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)
  const wlText = m.wlRatio === Infinity ? '∞' : m.wlRatio.toFixed(2)
  const scoreColor = score.composite >= 66 ? GREEN : score.composite >= 40 ? '#fbbf24' : RED

  const gridCols = (n: number) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${n}, 1fr)`, gap: isMobile ? 12 : 16 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16, padding: isMobile ? '14px 14px 24px' : '20px 26px 32px' }}>

      {showQuick && (
        <QuickAddModal initialDate={todayIso} tradingAccounts={tradingAccounts} onSave={onQuickAddTrade} onClose={() => setShowQuick(false)} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tracking</div>
          <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Dashboard</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ControlBar value={controls} onChange={setControls} accountNames={accountNames} symbols={symbols} />
          <button onClick={() => setShowQuick(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--btn-bg)', color: 'var(--btn-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <Zap size={14} /> Quick Add
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 10 : 14 }}>
        <KpiCard label="Net P&L" value={fmtUnit(m.netPnl, unit)}
          valueColor={m.netPnl > 0 ? GREEN : m.netPnl < 0 ? RED : 'var(--text)'}
          footer={<span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{m.count} trade{m.count !== 1 ? 's' : ''}</span>} />

        <KpiCard label="Trade win %" value={`${m.tradeWin.toFixed(1)}%`}
          right={<Donut segments={[{ value: m.wins, color: GREEN }, { value: m.bes, color: '#8a8a94' }, { value: m.losses, color: RED }]} />}
          footer={<div style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 700 }}><span style={{ color: GREEN }}>{m.wins}</span><span style={{ color: '#8a8a94' }}>{m.bes}</span><span style={{ color: RED }}>{m.losses}</span></div>} />

        <KpiCard label="Profit factor" value={pfText}
          right={<Donut segments={[{ value: Math.min(m.profitFactor === Infinity ? 3 : m.profitFactor, 3), color: GREEN }, { value: Math.max(3 - (m.profitFactor === Infinity ? 3 : m.profitFactor), 0), color: RED }]} />} />

        <KpiCard label="Day win %" value={`${m.dayWin.toFixed(0)}%`}
          right={<Donut segments={[{ value: m.winDays, color: GREEN }, { value: m.beDays, color: 'var(--accent)' }, { value: m.lossDays, color: RED }]} />}
          footer={<div style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 700 }}><span style={{ color: GREEN }}>{m.winDays}</span><span style={{ color: 'var(--accent)' }}>{m.beDays}</span><span style={{ color: RED }}>{m.lossDays}</span></div>} />

        <KpiCard label="Avg win/loss trade" value={wlText}
          footer={<div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', marginTop: 2 }}>
            <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-hover)' }}>
              <div style={{ width: `${(m.avgWin / (m.avgWin + m.avgLoss || 1)) * 100}%`, background: GREEN }} />
              <div style={{ flex: 1, background: RED }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}><span style={{ color: GREEN }}>${m.avgWin.toFixed(0)}</span><span style={{ color: RED }}>-${m.avgLoss.toFixed(0)}</span></div>
          </div>} />
      </div>

      {/* Score / Progress / Cumulative */}
      <div style={gridCols(3)}>
        {/* Performance score */}
        <div style={CARD}>
          <CardHead title="Performance score" />
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={score.radar} outerRadius="72%">
              <PolarGrid stroke="var(--border-mid)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
              <Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Your score</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor }}>{score.composite.toFixed(1)}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, borderRadius: 999, background: 'linear-gradient(90deg,#ef4444,#fbbf24,#22c55e)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -3, left: `calc(${clamp(score.composite, 0, 100)}% - 7px)`, width: 14, height: 14, borderRadius: 999, background: '#fff', border: '2px solid var(--bg-card)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}><span>0</span><span>50</span><span>100</span></div>
            </div>
          </div>
        </div>

        {/* Progress tracker */}
        <div style={CARD}>
          <CardHead title="Progress tracker" />
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 3, minWidth: 'min-content' }}>
              {heatmap.map((col, ci) => (
                <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {col.map(cell => {
                    const lvl = cell.count === 0 ? 0 : cell.count >= 4 ? 4 : cell.count
                    const bg = cell.inFuture ? 'transparent' : lvl === 0 ? 'var(--bg-hover)' : `rgba(34,197,94,${0.2 + lvl * 0.2})`
                    return <div key={cell.key} title={cell.count ? `${cell.key}: ${cell.count} trade(s), ${formatCurrency(cell.pnl)}` : cell.key} style={{ width: 13, height: 13, borderRadius: 3, background: bg, border: cell.inFuture ? 'none' : '1px solid var(--border)' }} />
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
            Less {[0, 1, 2, 3, 4].map(l => <div key={l} style={{ width: 11, height: 11, borderRadius: 3, background: l === 0 ? 'var(--bg-hover)' : `rgba(34,197,94,${0.2 + l * 0.2})`, border: '1px solid var(--border)' }} />)} More
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div><div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>Today's checklist</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{checkScore}/2</div></div>
              <button onClick={() => onNavigateToDiary?.(todayIso)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Open</button>
            </div>
            {checklist.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', fontSize: 14, color: c.done ? 'var(--text-sub)' : 'var(--text-muted)' }}>
                <span style={{ width: 17, height: 17, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.done ? 'rgba(34,197,94,0.15)' : 'var(--bg-hover)', border: `1px solid ${c.done ? 'rgba(34,197,94,0.4)' : 'var(--border-mid)'}`, color: GREEN, fontSize: 12, fontWeight: 800 }}>{c.done ? '✓' : ''}</span>
                {c.label}
              </div>
            ))}
          </div>
        </div>

        {/* Daily net cumulative P&L */}
        <div style={CARD}>
          <CardHead title="Daily net cumulative P&L" />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={m.equity} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.netPnl >= 0 ? GREEN : RED} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={m.netPnl >= 0 ? GREEN : RED} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={48} tickFormatter={(v: number) => fmtUnitAxis(v, unit)} />
              <ReferenceLine y={0} stroke="var(--border-mid)" />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [fmtUnit(v, unit), 'Cumulative']) as any} />
              <Area type="monotone" dataKey="value" stroke={m.netPnl >= 0 ? GREEN : RED} strokeWidth={2} fill="url(#cumFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily P&L / Recent trades / Account balance */}
      <div style={gridCols(3)}>
        {/* Net daily P&L */}
        <div style={CARD}>
          <CardHead title="Net daily P&L" />
          {m.dailyBars.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.dailyBars} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} minTickGap={20} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={48} tickFormatter={(v: number) => fmtUnitAxis(v, unit)} />
                <ReferenceLine y={0} stroke="var(--border-mid)" />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={((v: number) => [fmtUnit(v, unit), 'Net P&L']) as any} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {m.dailyBars.map((d, i) => <Cell key={i} fill={d.value >= 0 ? GREEN : RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent trades / open positions */}
        <div style={CARD}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
            {(['recent', 'open'] as const).map(t => (
              <button key={t} onClick={() => setTradesTab(t)} style={{ background: 'none', border: 'none', padding: '0 0 10px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: tradesTab === t ? 'var(--text)' : 'var(--text-dim)', borderBottom: `2px solid ${tradesTab === t ? 'var(--btn-bg)' : 'transparent'}`, fontFamily: 'inherit' }}>
                {t === 'recent' ? 'Recent trades' : 'Open positions'}
              </button>
            ))}
          </div>
          {tradesTab === 'open' ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 14 }}>No open positions</div>
          ) : recent.length === 0 ? <Empty /> : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0 4px 8px', borderBottom: '1px solid var(--border)' }}>
                {['Close Date', 'Symbol', 'Net P&L'].map((h, i) => <span key={h} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 2 ? 'right' : 'left' }}>{h}</span>)}
              </div>
              {recent.map((t, i) => {
                const p = netOf(t)
                return (
                  <div key={i} onClick={() => onNavigateToJournal(t.date)} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '9px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>{new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                    <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{t.symbol || '—'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: p >= 0 ? GREEN : RED, textAlign: 'right' }}>{p >= 0 ? '' : '-'}{formatCurrency(Math.abs(p))}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Account balance */}
        <div style={CARD}>
          <CardHead title="Account balance" />
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={balanceSeries.out} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={54} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [formatCurrency(v), 'Balance']) as any} />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>Starting balance: {formatCurrency(balanceSeries.base)}</div>
        </div>
      </div>

      {/* Calendar + Drawdown */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: isMobile ? 12 : 16 }}>
        <MonthCalendar
          year={year} month={month} trades={allTrades} journalEntries={acctEntries} diaryDates={diaryDates}
          onDayClick={date => onNavigateToJournal(date)}
          onDiaryClick={onNavigateToDiary}
          onPrevMonth={prevMonth} onNextMonth={nextMonth}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
          {/* Drawdown */}
          <div style={CARD}>
            <CardHead title="Drawdown" />
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={m.equity} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={48} tickFormatter={(v: number) => fmtUnitAxis(v, unit)} />
                <ReferenceLine y={0} stroke="var(--border-mid)" />
                <Tooltip {...tooltipStyle} formatter={((v: number) => [fmtUnit(v, unit), 'Drawdown']) as any} />
                <Area type="monotone" dataKey="dd" stroke="#8b5cf6" strokeWidth={2} fill="url(#ddFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trade time performance */}
          <div style={CARD}>
            <CardHead title="Trade time performance" />
            {timePoints.length === 0 ? <Empty text="Add trade times to see this" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 6, right: 10, left: -8, bottom: 0 }}>
                  <XAxis type="number" dataKey="hour" domain={[0, 24]} ticks={[1, 4, 7, 10, 13, 16, 19, 22]} tick={{ fontSize: 11, fill: 'var(--text-dim)' }} tickFormatter={h => `${pad(h)}:00`} />
                  <YAxis type="number" dataKey="pnl" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={48} tickFormatter={(v: number) => fmtUnitAxis(v, unit)} />
                  <ZAxis range={[45, 45]} />
                  <ReferenceLine y={0} stroke="var(--border-mid)" />
                  <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} formatter={((v: number, n: string) => n === 'pnl' ? [fmtUnit(v, unit), 'P&L'] : [v, n]) as any} />
                  <Scatter data={timePoints}>
                    {timePoints.map((p, i) => <Cell key={i} fill={p.pnl >= 0 ? GREEN : RED} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => onNavigateToJournal(todayIso)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-sub)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <NotebookPen size={15} /> Add Journal Entry
        </button>
      </div>

      {tradingRules.length > 0 && null}
    </div>
  )
}

function Empty({ text = 'No data yet' }: { text?: string }) {
  return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>{text}</div>
}
