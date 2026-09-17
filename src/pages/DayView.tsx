import { useState, useMemo } from 'react'
import { useMobile } from '../hooks/useMobile'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ChevronRight, ChevronLeft, StickyNote, ListTree, X } from 'lucide-react'
import { ControlBar, DEFAULT_CONTROLS } from '../components/ControlBar'
import type { Controls } from '../components/ControlBar'
import { tradeUnitValue, fmtUnit, fmtUnitAxis } from '../utils/units'
import { formatCurrency } from '../utils/stats'
import type { JournalEntry, TradingAccount, TradeLog } from '../types'

interface DayViewProps {
  journalEntries: JournalEntry[]
  tradingAccounts: TradingAccount[]
  diaryEntries: Record<string, string>
  onSaveDiary: (date: string, text: string) => void
  onNavigateToJournal: (date?: string) => void
}

const netOf = (t: { pnl: string; fees?: string }) => (parseFloat(t.pnl) || 0) - (parseFloat(t.fees || '0') || 0)
const num = (s?: string) => parseFloat(s || '') || 0
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const GREEN = '#22c55e', RED = '#ef4444'
const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', borderRadius: 8, fontSize: 13, color: 'var(--text-sub)', padding: '6px 10px' },
  itemStyle: { color: 'var(--text-sub)', padding: 0 }, labelStyle: { color: 'var(--text-muted)', fontSize: 12 },
}

type Row = { pnl: string; fees?: string; symbol: string; stopLoss?: string; contracts?: string; time?: string; result?: string; date: string }

function groupStats(rows: Row[], unit: Controls['unit']) {
  const count = rows.length
  const gross$ = rows.reduce((s, t) => s + num(t.pnl), 0)
  const commissions = rows.reduce((s, t) => s + num(t.fees), 0)
  const netUnit = rows.reduce((s, t) => s + tradeUnitValue(t, unit), 0)
  const grossUnit = unit === 'dollars' ? gross$ : netUnit
  const winners = rows.filter(t => netOf(t) > 0).length
  const losers = rows.filter(t => netOf(t) < 0).length
  const winRate = (winners + losers) > 0 ? (winners / (winners + losers)) * 100 : 0
  const volume = rows.reduce((s, t) => s + num(t.contracts), 0)
  const gp = rows.filter(t => netOf(t) > 0).reduce((s, t) => s + netOf(t), 0)
  const gl = Math.abs(rows.filter(t => netOf(t) < 0).reduce((s, t) => s + netOf(t), 0))
  const profitFactor = gl === 0 ? null : gp / gl
  // intraday cumulative in unit
  const sorted = [...rows].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  let cum = 0
  const chart = [{ i: 0, value: 0 }, ...sorted.map((t, i) => { cum += tradeUnitValue(t, unit); return { i: i + 1, value: +cum.toFixed(2) } })]
  return { count, grossUnit, netUnit, commissions, winners, losers, winRate, volume, profitFactor, chart }
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

export function DayView({ journalEntries, tradingAccounts, diaryEntries, onSaveDiary, onNavigateToJournal }: DayViewProps) {
  const isMobile = useMobile()
  const now = new Date()
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS)
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [calY, setCalY] = useState(now.getFullYear())
  const [calM, setCalM] = useState(now.getMonth())
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const unit = controls.unit

  const accountNames = tradingAccounts.map(a => a.name)
  const symbols = useMemo(() => Array.from(new Set(journalEntries.flatMap(e => e.trades.map(t => t.symbol).filter(Boolean)))).sort(), [journalEntries])

  const rows = useMemo(() => {
    let flat: Row[] = journalEntries.flatMap(e => e.trades.map(t => ({ ...t, date: e.date })))
    if (controls.account !== 'all') flat = flat.filter(t => ((t as unknown as TradeLog).accounts || []).includes(controls.account) || ((t as unknown as TradeLog).accounts || []).length === 0)
    if (controls.range === 'ytd') flat = flat.filter(t => t.date.startsWith(String(now.getFullYear())))
    else if (controls.range === 'month') flat = flat.filter(t => t.date.startsWith(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`))
    else if (controls.range === '30d') { const c = new Date(); c.setDate(c.getDate() - 30); const cs = iso(c); flat = flat.filter(t => t.date >= cs) }
    if (controls.result !== 'all') flat = flat.filter(t => t.result === controls.result)
    if (controls.symbol !== 'all') flat = flat.filter(t => t.symbol === controls.symbol)
    return flat
  }, [journalEntries, controls]) // eslint-disable-line react-hooks/exhaustive-deps

  // group by day or week
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>()
    rows.forEach(t => {
      let key = t.date
      if (mode === 'week') {
        const d = new Date(t.date + 'T12:00:00'); d.setDate(d.getDate() - d.getDay())
        key = iso(d)
      }
      map.set(key, [...(map.get(key) || []), t])
    })
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, rs]) => ({ key, rows: rs }))
  }, [rows, mode])

  const tradedDaysThisMonth = useMemo(() => {
    const set = new Set<number>()
    rows.forEach(t => { const d = new Date(t.date + 'T12:00:00'); if (d.getFullYear() === calY && d.getMonth() === calM) set.add(d.getDate()) })
    return set
  }, [rows, calY, calM])

  const label = (key: string) => {
    const d = new Date(key + 'T12:00:00')
    if (mode === 'week') {
      const end = new Date(d); end.setDate(end.getDate() + 6)
      return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const scrollToDay = (dateStr: string) => {
    const el = document.getElementById(`day-${dateStr}`)
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setExpanded(x => ({ ...x, [dateStr]: true })) }
  }

  // calendar grid
  const firstDow = new Date(calY, calM, 1).getDay()
  const daysInMonth = new Date(calY, calM + 1, 0).getDate()
  const calCells: (number | null)[] = [...Array(firstDow).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d)
  while (calCells.length % 7 !== 0) calCells.push(null)
  const prevMonth = () => { if (calM === 0) { setCalM(11); setCalY(y => y - 1) } else setCalM(mm => mm - 1) }
  const nextMonth = () => { if (calM === 11) { setCalM(0); setCalY(y => y + 1) } else setCalM(mm => mm + 1) }

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: isMobile ? '14px 14px 24px' : '20px 26px 32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tracking</div>
            <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Day View</div>
          </div>
          <ControlBar value={controls} onChange={setControls} accountNames={accountNames} symbols={symbols} />
        </div>

        {/* Day / Week toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 9, padding: 3, gap: 2 }}>
            {(['day', 'week'] as const).map(mo => (
              <button key={mo} onClick={() => setMode(mo)} style={{ padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', background: mode === mo ? 'var(--btn-bg)' : 'transparent', color: mode === mo ? 'var(--btn-text)' : 'var(--text-muted)' }}>
                {mo === 'day' ? 'Day' : 'Week'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: 16, alignItems: 'start' }}>
          {/* Day cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {groups.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 16, fontWeight: 600 }}>No trades in this range yet</div>
            ) : groups.map(({ key, rows: rs }) => {
              const st = groupStats(rs, unit)
              const isOpen = expanded[key] ?? true
              const hasNote = mode === 'day' && !!diaryEntries[key]?.trim()
              return (
                <div key={key} id={`day-${key}`} style={{ background: 'var(--card-sheen), var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', flexWrap: 'wrap' }}>
                    <button onClick={() => setExpanded(x => ({ ...x, [key]: !isOpen }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                      <ChevronRight size={18} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                    </button>
                    <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{label(key)}</span>
                    <span style={{ color: 'var(--text-dim)' }}>·</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: st.netUnit > 0 ? GREEN : st.netUnit < 0 ? RED : 'var(--text-sub)' }}>
                      Net P&L {fmtUnit(st.netUnit, unit)}
                    </span>
                    <div style={{ flex: 1 }} />
                    {mode === 'day' && (
                      <>
                        <button onClick={() => { setNoteFor(key); setNoteText(diaryEntries[key] || '') }} style={pillBtn}>
                          <StickyNote size={13} /> {hasNote ? 'Edit note' : 'Add note'}
                        </button>
                        <button onClick={() => onNavigateToJournal(key)} style={pillBtn}>
                          <ListTree size={13} /> Trades
                        </button>
                      </>
                    )}
                  </div>

                  {isOpen && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.4fr', gap: 18, padding: '4px 16px 18px', borderTop: '1px solid var(--border)' }}>
                      {/* chart */}
                      <div style={{ minWidth: 0, paddingTop: 12 }}>
                        <ResponsiveContainer width="100%" height={150}>
                          <AreaChart data={st.chart} margin={{ top: 4, right: 4, left: -6, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={st.netUnit >= 0 ? GREEN : RED} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={st.netUnit >= 0 ? GREEN : RED} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="i" hide />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={46} tickFormatter={(v: number) => fmtUnitAxis(v, unit)} />
                            <ReferenceLine y={0} stroke="var(--border-mid)" />
                            <Tooltip {...tooltipStyle} formatter={((v: number) => [fmtUnit(v, unit), 'Cumulative']) as any} labelFormatter={() => ''} />
                            <Area type="monotone" dataKey="value" stroke={st.netUnit >= 0 ? GREEN : RED} strokeWidth={2} fill={`url(#g-${key})`} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {/* stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: 16, columnGap: 10, paddingTop: 12 }}>
                        <Stat label="Total Trades" value={String(st.count)} />
                        <Stat label="Gross P&L" value={fmtUnit(st.grossUnit, unit)} color={st.grossUnit >= 0 ? GREEN : RED} />
                        <Stat label="Winners / Losers" value={`${st.winners} / ${st.losers}`} />
                        <Stat label="Commissions" value={formatCurrency(st.commissions)} />
                        <Stat label="Win Rate" value={`${st.winRate.toFixed(0)}%`} />
                        <Stat label="Volume" value={String(st.volume)} />
                        <Stat label="Profit Factor" value={st.profitFactor === null ? '--' : st.profitFactor.toFixed(2)} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Calendar */}
          {!isMobile && (
            <div style={{ background: 'var(--card-sheen), var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-card)', padding: '14px 14px 16px', position: 'sticky', top: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={prevMonth} style={calNav}><ChevronLeft size={16} /></button>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{new Date(calY, calM).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <button onClick={nextMonth} style={calNav}><ChevronRight size={16} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                {WD.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {calCells.map((d, i) => {
                  if (d === null) return <div key={i} />
                  const dateStr = `${calY}-${pad(calM + 1)}-${pad(d)}`
                  const traded = tradedDaysThisMonth.has(d)
                  const isToday = dateStr === iso(now)
                  return (
                    <button key={i} onClick={() => traded && scrollToDay(dateStr)} disabled={!traded}
                      style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: traded ? 700 : 500, borderRadius: 8, border: `1px solid ${isToday ? 'var(--border-strong)' : 'var(--border)'}`, cursor: traded ? 'pointer' : 'default', fontFamily: 'inherit',
                        background: traded ? 'rgba(34,197,94,0.16)' : 'var(--bg)', color: traded ? '#7ee2a8' : 'var(--text-dim)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (traded) e.currentTarget.style.background = 'rgba(34,197,94,0.28)' }}
                      onMouseLeave={e => { if (traded) e.currentTarget.style.background = 'rgba(34,197,94,0.16)' }}>{d}</button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Note modal */}
      {noteFor && (
        <div onClick={e => { if (e.target === e.currentTarget) setNoteFor(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-sheen), var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <StickyNote size={16} color="var(--text-sub)" />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Note · {new Date(noteFor + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <button onClick={() => setNoteFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}><X size={17} /></button>
            </div>
            <div style={{ padding: 18 }}>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What happened this day? Mindset, mistakes, what went well…" autoFocus
                style={{ width: '100%', minHeight: 180, resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-mid)', borderRadius: 10, padding: 12, fontSize: 15, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button onClick={() => setNoteFor(null)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={() => { onSaveDiary(noteFor, noteText); setNoteFor(null) }} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--btn-bg)', color: 'var(--btn-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save note</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const pillBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border-mid)',
  background: 'transparent', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const calNav: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
