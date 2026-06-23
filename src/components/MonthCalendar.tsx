import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getDayPnl, hasDayTrades, formatCurrency } from '../utils/stats'
import type { DashTrade, JournalEntry } from '../types'

interface MonthCalendarProps {
  year: number
  month: number
  trades: DashTrade[]
  journalEntries?: JournalEntry[]
  diaryDates?: string[]
  onDayClick: (date: string) => void
  onDiaryClick?: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }

function calcDayR(trades: JournalEntry['trades']): number | null {
  let total = 0
  let hasAny = false
  for (const t of trades) {
    const pv = PVMAP[t.symbol] ?? 0
    const sl = parseFloat(t.stopLoss), c = parseFloat(t.contracts)
    if (!pv || isNaN(sl) || isNaN(c) || c <= 0 || sl === 0) continue
    const risk = sl * pv * c
    if (risk === 0) continue
    hasAny = true
    total += (parseFloat(t.pnl) || 0) / risk
  }
  return hasAny ? total : null
}

export function MonthCalendar({ year, month, trades, journalEntries, diaryDates, onDayClick, onDiaryClick, onPrevMonth, onNextMonth }: MonthCalendarProps) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = new Date().toISOString().split('T')[0]

  const monthTrades = trades.filter(t => {
    const d = new Date(t.date + 'T12:00:00')
    return d.getFullYear() === year && d.getMonth() === month
  })
  const monthPnl = monthTrades.reduce((s, t) => s + t.pnl, 0)
  const monthTradeCount = monthTrades.length
  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const cells: (number | null)[] = [...Array(firstDay).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const pad = (n: number) => String(n).padStart(2, '0')

  const navBtnStyle: React.CSSProperties = {
    padding: '5px 8px', borderRadius: 8,
    background: '#1a1a1a', border: '1px solid #252525',
    color: '#555', cursor: 'pointer', display: 'flex',
    alignItems: 'center', transition: 'all 0.15s',
  }

  const colTemplate = 'repeat(8, 1fr)'

  return (
    <div style={{ background: '#141414', border: '1px solid #1f1f1f', borderRadius: 16, padding: '20px 20px 18px' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#444', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Trade Calendar</h3>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onPrevMonth}
            style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.color = '#ddd'; e.currentTarget.style.borderColor = '#444' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#252525' }}
          >
            <ChevronLeft size={13} strokeWidth={2} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#999', minWidth: 120, textAlign: 'center' }}>
            {monthLabel}
          </span>
          <button
            onClick={onNextMonth}
            style={navBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.color = '#ddd'; e.currentTarget.style.borderColor = '#444' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#252525' }}
          >
            <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>

        {/* Month P&L + trade count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <span style={{ fontSize: 12, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Monthly Profit</span>
            <span style={{
              fontSize: 18, fontWeight: 700,
              color: monthTradeCount === 0 ? '#333' : monthPnl >= 0 ? '#4ade80' : '#f87171',
            }}>
              {monthTradeCount === 0 ? '—' : (monthPnl >= 0 ? '+' : '') + formatCurrency(monthPnl)}
            </span>
          </div>
          <div style={{ width: 1, height: 28, background: '#222' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <span style={{ fontSize: 12, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total Trades</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#888' }}>
              {monthTradeCount}
            </span>
          </div>
        </div>
      </div>

      {/* Weekday headers + Week column header */}
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 4, marginBottom: 6 }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ fontSize: 12, fontWeight: 700, color: '#444', padding: '4px 0 4px 7px' }}>
            {d}
          </div>
        ))}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#333', padding: '4px 0', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Week
        </div>
      </div>

      {/* Calendar rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weeks.map((week, wi) => {
          const weekDays = week.filter((d): d is number => d !== null)
          const weekDateStrs = weekDays.map(d => `${year}-${pad(month + 1)}-${pad(d)}`)
          const weekTradesData = trades.filter(t => weekDateStrs.includes(t.date))
          const weekPnl = weekTradesData.reduce((s, t) => s + t.pnl, 0)
          const weekCount = weekTradesData.length
          const weekHasData = weekCount > 0
          const weekEntries = journalEntries?.filter(e => weekDateStrs.includes(e.date)) ?? []
          const weekLogs = weekEntries.flatMap(e => e.trades)
          const weekWins = weekLogs.filter(t => t.result === 'Win').length
          const weekLosses = weekLogs.filter(t => t.result === 'Loss').length
          const weekBEs = weekLogs.filter(t => t.result === 'BE').length
          const weekR = weekLogs.length > 0 ? calcDayR(weekLogs) : null
          const weekWLBE = [weekWins > 0 ? `${weekWins}W` : null, weekLosses > 0 ? `${weekLosses}L` : null, weekBEs > 0 ? `${weekBEs}BE` : null].filter(Boolean)
          const weekPnlColor = weekHasData ? (weekPnl > 0 ? '#4ade80' : weekPnl < 0 ? '#f87171' : '#888') : '#444'
          const weekBg = weekHasData
            ? weekPnl > 0 ? 'rgba(52,211,153,0.05)' : weekPnl < 0 ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.02)'
            : 'transparent'
          const weekBorder = weekHasData
            ? weekPnl > 0 ? 'rgba(52,211,153,0.15)' : weekPnl < 0 ? 'rgba(248,113,113,0.15)' : '#1e1e1e'
            : '#141414'

          return (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 4 }}>
              {week.map((day, di) => {
                if (day === null) return <div key={`e-${wi}-${di}`} />

                const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
                const pnl = getDayPnl(trades, dateStr)
                const hasData = hasDayTrades(trades, dateStr)
                const isToday = dateStr === todayStr
                const isPositive = pnl > 0
                const isNegative = pnl < 0
                const isWeekend = new Date(dateStr + 'T12:00:00').getDay() === 0 || new Date(dateStr + 'T12:00:00').getDay() === 6
                const count = trades.filter(t => t.date === dateStr).length

                const dayEntry = journalEntries?.find(e => e.date === dateStr)
                const dayLogs = dayEntry?.trades ?? []
                const wins = dayLogs.filter(t => t.result === 'Win').length
                const losses = dayLogs.filter(t => t.result === 'Loss').length
                const bes = dayLogs.filter(t => t.result === 'BE').length
                const dayR = dayLogs.length > 0 ? calcDayR(dayLogs) : null
                const hasDiary = diaryDates?.includes(dateStr) ?? false

                const wlbeParts = [
                  wins > 0 ? `${wins}W` : null,
                  losses > 0 ? `${losses}L` : null,
                  bes > 0 ? `${bes}BE` : null,
                ].filter(Boolean)

                let cellBg = '#0e0e0e'
                let cellBorder = '#1a1a1a'
                let dayNumColor = '#444'

                if (hasData && isPositive)  { cellBg = 'rgba(52,211,153,0.08)';  cellBorder = 'rgba(52,211,153,0.2)';  dayNumColor = '#cccccc' }
                if (hasData && isNegative)  { cellBg = 'rgba(248,113,113,0.08)'; cellBorder = 'rgba(248,113,113,0.2)'; dayNumColor = '#cccccc' }
                if (hasData && !isPositive && !isNegative) { cellBg = 'rgba(255,255,255,0.04)'; cellBorder = '#2a2a2a'; dayNumColor = '#cccccc' }

                return (
                  <button
                    key={dateStr}
                    onClick={() => onDayClick(dateStr)}
                    style={{
                      borderRadius: 10, padding: '8px 7px 7px', minHeight: 100,
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      justifyContent: 'flex-start', gap: 2,
                      background: cellBg,
                      border: `1px solid ${isToday ? '#4a4a4a' : cellBorder}`,
                      cursor: 'pointer',
                      opacity: isWeekend && !hasData ? 0.35 : 1,
                      outline: isToday ? '1px solid #333' : 'none',
                      outlineOffset: 2,
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.background = hasData ? cellBg : '#151515' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isToday ? '#4a4a4a' : cellBorder; e.currentTarget.style.background = cellBg }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: dayNumColor, lineHeight: 1 }}>
                        {day}
                      </span>
                      {hasDiary && (
                        <button
                          onClick={e => { e.stopPropagation(); onDiaryClick?.(dateStr) }}
                          title="Open Daily Journal"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, lineHeight: 1, opacity: 0.7, display: 'flex', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                        >📝</button>
                      )}
                    </div>
                    {hasData && (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isPositive ? '#4ade80' : isNegative ? '#f87171' : '#888', lineHeight: 1, marginTop: 2 }}>
                          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        </span>
                        {dayR !== null && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: dayR > 0 ? '#4ade80' : dayR < 0 ? '#f87171' : '#888', lineHeight: 1 }}>
                            {dayR >= 0 ? '+' : ''}{dayR.toFixed(1)}R
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: '#666', fontWeight: 600, lineHeight: 1 }}>
                          {count} trade{count !== 1 ? 's' : ''}
                        </span>
                        {wlbeParts.length > 0 && (
                          <span style={{ fontSize: 11, color: '#555', fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
                            {wlbeParts.join(' - ')}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )
              })}

              {/* Weekly stats cell */}
              <div style={{
                borderRadius: 10, padding: '8px 10px', minHeight: 100,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                justifyContent: 'flex-start', gap: 3,
                background: weekBg,
                border: `1px solid ${weekBorder}`,
                borderLeft: `2px solid ${weekHasData ? (weekPnl > 0 ? 'rgba(52,211,153,0.4)' : weekPnl < 0 ? 'rgba(248,113,113,0.4)' : '#2a2a2a') : '#1a1a1a'}`,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                  WK {wi + 1}
                </span>
                {weekHasData ? (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 800, color: weekPnlColor, lineHeight: 1, marginTop: 2 }}>
                      {weekPnl >= 0 ? '+' : ''}{formatCurrency(weekPnl)}
                    </span>
                    {weekR !== null && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: weekR > 0 ? '#4ade80' : weekR < 0 ? '#f87171' : '#888', lineHeight: 1 }}>
                        {weekR >= 0 ? '+' : ''}{weekR.toFixed(1)}R
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#666', fontWeight: 600, lineHeight: 1 }}>
                      {weekCount} trade{weekCount !== 1 ? 's' : ''}
                    </span>
                    {weekWLBE.length > 0 && (
                      <span style={{ fontSize: 11, color: '#555', fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
                        {weekWLBE.join(' - ')}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#252525', marginTop: 4 }}>—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Color key */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 16, paddingTop: 14, borderTop: '1px solid #1a1a1a' }}>
        {[
          { bg: 'rgba(52,211,153,0.2)', border: 'rgba(52,211,153,0.3)', label: 'Win' },
          { bg: 'rgba(248,113,113,0.2)', border: 'rgba(248,113,113,0.3)', label: 'Loss' },
          { bg: 'rgba(255,255,255,0.07)', border: '#2a2a2a', label: 'Breakeven' },
        ].map(({ bg, border, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
            <span style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
