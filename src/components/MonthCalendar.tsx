import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getDayPnl, hasDayTrades, formatCurrency } from '../utils/stats'
import type { DashTrade, JournalEntry } from '../types'
import { useMobile } from '../hooks/useMobile'

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
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

function fmtPnlShort(pnl: number): string {
  const abs = Math.abs(pnl)
  const sign = pnl >= 0 ? '+' : '-'
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
  return `${sign}$${Math.round(abs)}`
}

export function MonthCalendar({ year, month, trades, journalEntries, diaryDates, onDayClick, onDiaryClick, onPrevMonth, onNextMonth }: MonthCalendarProps) {
  const isMobile = useMobile()
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
  const monthLabelShort = new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  const cells: (number | null)[] = [...Array(firstDay).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const pad = (n: number) => String(n).padStart(2, '0')

  const navBtnStyle: React.CSSProperties = {
    padding: isMobile ? '4px 5px' : '5px 8px', borderRadius: 8,
    background: 'var(--bg-hover)', border: '1px solid var(--border-mid)',
    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', transition: 'all 0.15s',
  }

  const colTemplate = isMobile ? 'repeat(7, 1fr)' : 'repeat(8, 1fr)'

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: isMobile ? '12px 10px 10px' : '20px 20px 18px' }}>

      {/* Header */}
      {isMobile ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Trade Calendar</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={onPrevMonth}
                style={navBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
              >
                <ChevronLeft size={11} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', textAlign: 'center' }}>
                {monthLabelShort}
              </span>
              <button
                onClick={onNextMonth}
                style={navBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
              >
                <ChevronRight size={11} strokeWidth={2} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>P&L</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: monthTradeCount === 0 ? '#333' : monthPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                  {monthTradeCount === 0 ? '—' : (monthPnl >= 0 ? '+' : '') + formatCurrency(monthPnl)}
                </span>
              </div>
              <div style={{ width: 1, height: 20, background: 'var(--border-mid)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trades</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}>{monthTradeCount}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dim)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Trade Calendar</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onPrevMonth}
              style={navBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
            >
              <ChevronLeft size={13} strokeWidth={2} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-sub)', minWidth: 120, textAlign: 'center' }}>
              {monthLabel}
            </span>
            <button
              onClick={onNextMonth}
              style={navBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
            >
              <ChevronRight size={13} strokeWidth={2} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Monthly Profit</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: monthTradeCount === 0 ? '#333' : monthPnl >= 0 ? '#22c55e' : '#ef4444' }}>
                {monthTradeCount === 0 ? '—' : (monthPnl >= 0 ? '+' : '') + formatCurrency(monthPnl)}
              </span>
            </div>
            <div style={{ width: 1, height: 28, background: 'var(--border-mid)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total Trades</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-sub)' }}>{monthTradeCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: isMobile ? 2 : 4, marginBottom: isMobile ? 3 : 6 }}>
        {(isMobile ? WEEKDAYS_SHORT : WEEKDAYS).map((d, i) => (
          <div key={i} style={{ fontSize: isMobile ? 10 : 14, fontWeight: 700, color: 'var(--text-dim)', padding: isMobile ? '2px 0 2px 2px' : '4px 0 4px 7px' }}>
            {d}
          </div>
        ))}
        {!isMobile && (
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dim)', padding: '4px 0', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Week
          </div>
        )}
      </div>

      {/* Calendar rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 4 }}>
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
          const weekPnlColor = weekHasData ? (weekPnl > 0 ? '#22c55e' : weekPnl < 0 ? '#ef4444' : '#888') : '#444'
          const weekBg = weekHasData
            ? weekPnl > 0 ? 'rgba(52,211,153,0.05)' : weekPnl < 0 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)'
            : 'transparent'
          const weekBorder = weekHasData
            ? weekPnl > 0 ? 'rgba(52,211,153,0.15)' : weekPnl < 0 ? 'rgba(239,68,68,0.15)' : 'var(--border-mid)'
            : 'var(--border)'

          return (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: isMobile ? 2 : 4 }}>
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

                let cellBg = 'var(--bg)'
                let cellBorder = 'var(--border)'
                let dayNumColor = 'var(--text-dim)'

                if (hasData && isPositive)  { cellBg = 'rgba(52,211,153,0.08)';  cellBorder = 'rgba(52,211,153,0.2)';  dayNumColor = '#cccccc' }
                if (hasData && isNegative)  { cellBg = 'rgba(239,68,68,0.08)'; cellBorder = 'rgba(239,68,68,0.2)'; dayNumColor = '#cccccc' }
                if (hasData && !isPositive && !isNegative) { cellBg = 'var(--bg-hover)'; cellBorder = 'var(--border-mid)'; dayNumColor = 'var(--text-sub)' }

                return (
                  <button
                    key={dateStr}
                    onClick={() => onDayClick(dateStr)}
                    style={{
                      borderRadius: isMobile ? 5 : 10,
                      padding: isMobile ? '4px 3px 3px' : '8px 7px 7px',
                      minHeight: isMobile ? 62 : 100,
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      justifyContent: 'flex-start', gap: 1,
                      background: cellBg,
                      border: `1px solid ${isToday ? '#4a4a4a' : cellBorder}`,
                      cursor: 'pointer',
                      opacity: isWeekend && !hasData ? 0.35 : 1,
                      outline: isToday ? '1px solid #333' : 'none',
                      outlineOffset: 2,
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = hasData ? cellBg : 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isToday ? 'var(--border-strong)' : cellBorder; e.currentTarget.style.background = cellBg }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: isMobile ? 10 : 16, fontWeight: 700, color: dayNumColor, lineHeight: 1 }}>
                        {day}
                      </span>
                      {!isMobile && hasDiary && (
                        <button
                          onClick={e => { e.stopPropagation(); onDiaryClick?.(dateStr) }}
                          title="Open Daily Journal"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, lineHeight: 1, opacity: 0.7, display: 'flex', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                        >📝</button>
                      )}
                    </div>
                    {hasData && (
                      <>
                        <span style={{ fontSize: isMobile ? 9 : 15, fontWeight: 800, color: isPositive ? '#22c55e' : isNegative ? '#ef4444' : '#888', lineHeight: 1, marginTop: 1 }}>
                          {isMobile ? fmtPnlShort(pnl) : (pnl >= 0 ? '+' : '') + formatCurrency(pnl)}
                        </span>
                        {dayR !== null && (
                          <span style={{ fontSize: isMobile ? 8 : 14, fontWeight: 700, color: dayR > 0 ? '#22c55e' : dayR < 0 ? '#ef4444' : '#888', lineHeight: 1 }}>
                            {dayR >= 0 ? '+' : ''}{dayR.toFixed(1)}R
                          </span>
                        )}
                        <span style={{ fontSize: isMobile ? 8 : 14, color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1 }}>
                          {count} trade{count !== 1 ? 's' : ''}
                        </span>
                        {wlbeParts.length > 0 && (
                          <span style={{ fontSize: isMobile ? 8 : 13, color: 'var(--text-muted)', fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
                            {wlbeParts.join(' - ')}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )
              })}

              {/* Weekly stats cell — desktop only */}
              {!isMobile && (
                <div style={{
                  borderRadius: 10, padding: '8px 10px', minHeight: 100,
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  justifyContent: 'flex-start', gap: 3,
                  background: weekBg,
                  border: `1px solid ${weekBorder}`,
                  borderLeft: `2px solid ${weekHasData ? (weekPnl > 0 ? 'rgba(52,211,153,0.4)' : weekPnl < 0 ? 'rgba(239,68,68,0.4)' : '#2a2a2a') : '#1a1a1a'}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                    WK {wi + 1}
                  </span>
                  {weekHasData ? (
                    <>
                      <span style={{ fontSize: 15, fontWeight: 800, color: weekPnlColor, lineHeight: 1, marginTop: 2 }}>
                        {weekPnl >= 0 ? '+' : ''}{formatCurrency(weekPnl)}
                      </span>
                      {weekR !== null && (
                        <span style={{ fontSize: 14, fontWeight: 700, color: weekR > 0 ? '#22c55e' : weekR < 0 ? '#ef4444' : '#888', lineHeight: 1 }}>
                          {weekR >= 0 ? '+' : ''}{weekR.toFixed(1)}R
                        </span>
                      )}
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1 }}>
                        {weekCount} trade{weekCount !== 1 ? 's' : ''}
                      </span>
                      {weekWLBE.length > 0 && (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
                          {weekWLBE.join(' - ')}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 14, color: 'var(--border-mid)', marginTop: 4 }}>—</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Color key */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 14 : 22, marginTop: isMobile ? 10 : 16, paddingTop: isMobile ? 8 : 14, borderTop: '1px solid var(--border)' }}>
        {[
          { bg: 'rgba(52,211,153,0.2)', border: 'rgba(52,211,153,0.3)', label: 'Win' },
          { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.3)', label: 'Loss' },
          { bg: 'var(--bg-hover)', border: 'var(--border-mid)', label: 'Breakeven' },
        ].map(({ bg, border, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6 }}>
            <div style={{ width: isMobile ? 8 : 12, height: isMobile ? 8 : 12, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
            <span style={{ fontSize: isMobile ? 11 : 14, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
