import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts'
import type { JournalEntry, DashTrade } from '../types'
import { formatCurrency } from '../utils/stats'

const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }

interface Props {
  allTrades: DashTrade[]
  monthTrades: DashTrade[]
  journalEntries: JournalEntry[]
}

const CARD: React.CSSProperties = {
  background: '#141414', border: '1px solid #1f1f1f', borderRadius: 16, padding: '18px 20px 14px',
}
const TITLE: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#444', margin: '0 0 14px',
  textTransform: 'uppercase', letterSpacing: '0.07em',
}
const EMPTY = (
  <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#272727', fontSize: 13, fontWeight: 600 }}>
    No data yet
  </div>
)
const TOOLTIP = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12, color: '#ccc', padding: '6px 10px' },
  itemStyle: { color: '#ccc', padding: 0 },
  labelStyle: { color: '#555', fontSize: 11, marginBottom: 2 },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}
const AXIS_TICK = { fontSize: 10, fill: '#3a3a3a' }

function yFmt(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`
  return `${v < 0 ? '-' : ''}$${abs}`
}

export function DashboardCharts({ allTrades, monthTrades, journalEntries }: Props) {
  // ── 1. Equity Curve (all time, per trade) ──────────────────────────────
  const sorted = [...allTrades].sort((a, b) => a.date.localeCompare(b.date))
  let cum = 0
  const equityData = [
    { label: '', value: 0 },
    ...sorted.map(t => {
      cum += t.pnl
      return { label: t.date.slice(5), value: parseFloat(cum.toFixed(2)) }
    }),
  ]
  const equityColor = equityData[equityData.length - 1]?.value >= 0 ? '#4ade80' : '#f87171'

  // ── 2. Cumulative R:R (all time) ───────────────────────────────────────
  const allJournalTrades = journalEntries
    .flatMap(e => e.trades.map(t => ({ t, date: e.date })))
    .sort((a, b) => a.date.localeCompare(b.date))
  let cumR = 0
  const rrData: { label: string; value: number }[] = [{ label: '', value: 0 }]
  allJournalTrades.forEach(({ t, date }) => {
    const pv = PVMAP[t.symbol] ?? 0
    const sl = parseFloat(t.stopLoss)
    const c = parseFloat(t.contracts)
    if (!pv || isNaN(sl) || isNaN(c) || c <= 0 || sl === 0) return
    const risk = sl * pv * c
    if (risk === 0) return
    cumR += (parseFloat(t.pnl) || 0) / risk
    rrData.push({ label: date.slice(5), value: parseFloat(cumR.toFixed(2)) })
  })
  const rrColor = rrData[rrData.length - 1]?.value >= 0 ? '#4ade80' : '#f87171'

  // ── 3. Daily Performance (current month) ──────────────────────────────
  const dayMap = new Map<string, number>()
  monthTrades.forEach(t => { dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + t.pnl) })
  const dailyData = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ label: parseInt(date.slice(8), 10).toString(), value: parseFloat(value.toFixed(2)) }))

  // ── 4. P&L by Session (all time) ──────────────────────────────────────
  const sessionMap = new Map<string, number>()
  journalEntries.forEach(e => {
    e.trades.forEach(t => {
      const pnl = parseFloat(t.pnl) || 0
      const sessions = t.sessions.length > 0 ? t.sessions : ['Other']
      sessions.forEach(s => { sessionMap.set(s, (sessionMap.get(s) ?? 0) + pnl) })
    })
  })
  const sessionData = Array.from(sessionMap.entries())
    .map(([label, value]) => ({ label, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

      {/* Equity Curve */}
      <div style={CARD}>
        <p style={TITLE}>Equity Curve</p>
        {equityData.length < 2 ? EMPTY : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={equityData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={56} />
              <ReferenceLine y={0} stroke="#252525" strokeDasharray="3 3" />
              <Tooltip {...TOOLTIP} formatter={(v: unknown) => [formatCurrency(Number(v)), 'Equity']} />
              <Line type="monotone" dataKey="value" stroke={equityColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cumulative R:R */}
      <div style={CARD}>
        <p style={TITLE}>Cumulative R</p>
        {rrData.length < 2 ? EMPTY : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={rrData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `${v}R`} width={44} />
              <ReferenceLine y={0} stroke="#252525" strokeDasharray="3 3" />
              <Tooltip {...TOOLTIP} formatter={(v: unknown) => [`${Number(v)}R`, 'Cum. R']} />
              <Line type="monotone" dataKey="value" stroke={rrColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily Performance */}
      <div style={CARD}>
        <p style={TITLE}>Daily Performance</p>
        {dailyData.length === 0 ? EMPTY : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={56} />
              <ReferenceLine y={0} stroke="#252525" />
              <Tooltip {...TOOLTIP} formatter={(v: unknown) => [formatCurrency(Number(v)), 'P&L']} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {dailyData.map((d, i) => (
                  <Cell key={i} fill={d.value >= 0 ? '#4ade80' : '#f87171'} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* P&L by Session */}
      <div style={CARD}>
        <p style={TITLE}>P&L by Session</p>
        {sessionData.length === 0 ? EMPTY : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sessionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={yFmt} width={56} />
              <ReferenceLine y={0} stroke="#252525" />
              <Tooltip {...TOOLTIP} formatter={(v: unknown) => [formatCurrency(Number(v)), 'P&L']} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {sessionData.map((d, i) => (
                  <Cell key={i} fill={d.value >= 0 ? '#4ade80' : '#f87171'} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
