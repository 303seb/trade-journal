import { useState, useEffect } from 'react'
import { useMobile } from '../hooks/useMobile'
import { NotebookPen, TrendingUp, DollarSign, BarChart2, Award, Activity, Calendar, X, AlertTriangle } from 'lucide-react'
import { StatCard } from '../components/StatCard'
import { IncomeGoal } from '../components/IncomeGoal'
import { MonthCalendar } from '../components/MonthCalendar'
import { DashboardCharts } from '../components/DashboardCharts'
import {
  getDashTrades,
  getMonthTrades,
  getYearTrades,
  calcNetPnl,
  calcWinRate,
  calcProfitFactor,
  getDayPnl,
  formatCurrency,
  formatPct,
} from '../utils/stats'

const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }
import type { JournalEntry, TradingRule, TradeLog } from '../types'

const QUOTES = [
  { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
  { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { text: "Plan the trade and trade the plan.", author: "Unknown" },
  { text: "Amateurs want to be right. Professionals want to make money.", author: "Unknown" },
  { text: "The market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "In trading, the hardest thing is to sit on your hands and do nothing.", author: "Jesse Livermore" },
  { text: "Every loss is a lesson. Every win is confirmation.", author: "Unknown" },
]

const EMOTION_DISPLAY: Record<string, { emoji: string; label: string }> = {
  very_happy:  { emoji: '😄', label: 'Very Happy'   },
  happy:       { emoji: '🙂', label: 'Satisfied'    },
  neutral:     { emoji: '😐', label: 'Neutral'      },
  frustrated:  { emoji: '😕', label: 'Frustrated'   },
  angry:       { emoji: '😤', label: 'Disappointed' },
  very_angry:  { emoji: '😡', label: 'Very Angry'   },
}

const RESULT_COLORS: Record<string, string> = {
  Win: '#22c55e', Loss: '#ef4444', BE: '#aaaaaa', "Didn't take": '#fb923c',
}

interface DashboardProps {
  journalEntries: JournalEntry[]
  monthlyGoals: { month: string; amount: number }[]
  tradingRules: TradingRule[]
  onSetGoal: (month: string, amount: number) => void
  onNavigateToJournal: (date?: string) => void
  onNavigateToDiary?: (date: string) => void
  diaryDates?: string[]
}

export function Dashboard({ journalEntries, monthlyGoals, tradingRules, onSetGoal, onNavigateToJournal, onNavigateToDiary, diaryDates }: DashboardProps) {
  const isMobile = useMobile()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [nyTime, setNyTime] = useState('')

  useEffect(() => {
    const update = () => {
      setNyTime(new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])
  const [popupDate, setPopupDate] = useState<string | null>(null)
  const [recentTradePopup, setRecentTradePopup] = useState<{ trade: TradeLog; date: string } | null>(null)

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const allTrades = getDashTrades(journalEntries)
  const yearTrades = getYearTrades(allTrades, year)
  const monthTrades = getMonthTrades(allTrades, year, month)

  const yearlyPnl = calcNetPnl(yearTrades)
  const netPnl = calcNetPnl(monthTrades)
  const todayPnl = getDayPnl(allTrades, todayStr)
  const winRate = calcWinRate(monthTrades)
  const profitFactor = calcProfitFactor(monthTrades)
  const goalAmount = monthlyGoals.find(g => g.month === monthStr)?.amount ?? 0

  const monthCumR = (() => {
    let cumR = 0
    for (const entry of journalEntries) {
      const d = new Date(entry.date + 'T12:00:00')
      if (d.getFullYear() !== year || d.getMonth() !== month) continue
      for (const t of entry.trades) {
        const risk = parseFloat(t.stopLoss) * (PVMAP[t.symbol] || 1) * parseFloat(t.contracts)
        if (risk > 0) {
          const net = (parseFloat(t.pnl) || 0) - (parseFloat(t.fees || '0') || 0)
          cumR += net / risk
        }
      }
    }
    return cumR
  })()

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const quote = QUOTES[now.getDay()]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 18, padding: isMobile ? '14px 14px 20px' : '22px 28px 32px' }}>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* NY Time clock */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: isMobile ? 20 : 30, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {nyTime || '—'}
          </span>
          <span style={{ fontSize: isMobile ? 11 : 13, color: 'var(--text-dim)', fontWeight: 600, marginTop: 2, letterSpacing: '0.04em' }}>ET · New York</span>
        </div>

        <button
          onClick={() => onNavigateToJournal(todayStr)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
            background: 'var(--btn-bg)', color: 'var(--btn-text)', borderRadius: 10, border: 'none',
            fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-bg)')}
        >
          <NotebookPen size={15} />
          {isMobile ? 'Log Trade' : 'Add Journal Entry'}
        </button>
      </div>

      {/* Stats — 6 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? 8 : 12 }}>
        <StatCard
          label="Yearly P&L"
          value={formatCurrency(yearlyPnl)}
          sub={`${year} total`}
          positive={yearTrades.length === 0 ? null : yearlyPnl >= 0}
          icon={<Calendar size={15} />}
        />
        <StatCard
          label="Net P&L"
          value={formatCurrency(netPnl)}
          sub={`${monthTrades.length} trade${monthTrades.length !== 1 ? 's' : ''} this month`}
          positive={monthTrades.length === 0 ? null : netPnl >= 0}
          icon={<DollarSign size={15} />}
        />
        <StatCard
          label="Today's P&L"
          value={formatCurrency(todayPnl)}
          sub="current day"
          positive={todayPnl === 0 ? null : todayPnl > 0}
          icon={<TrendingUp size={15} />}
        />
        <StatCard
          label="Win Rate"
          value={formatPct(winRate)}
          sub={`${monthTrades.filter(t => t.pnl > 0).length}W / ${monthTrades.filter(t => t.pnl < 0).length}L`}
          positive={monthTrades.length === 0 ? null : winRate >= 50}
          icon={<Award size={15} />}
        />
        <StatCard
          label="Profit Factor"
          value={profitFactor >= 999 ? '∞' : profitFactor.toFixed(2)}
          sub={profitFactor >= 1 ? 'Profitable' : 'Unprofitable'}
          positive={monthTrades.length === 0 ? null : profitFactor >= 1}
          icon={<BarChart2 size={15} />}
        />
        <StatCard
          label="Cumulative R"
          value={monthTrades.length === 0 ? '—' : `${monthCumR >= 0 ? '+' : ''}${monthCumR.toFixed(2)}R`}
          sub="this month"
          positive={monthTrades.length === 0 ? null : monthCumR >= 0}
          icon={<Activity size={15} />}
        />
      </div>

      {/* Quote */}
      <div style={{
        background: 'var(--card-sheen), var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
        padding: isMobile ? '12px 14px' : '20px 28px', textAlign: 'center', boxShadow: 'var(--shadow-card)',
      }}>
        <p style={{ fontSize: isMobile ? 13 : 18, color: 'var(--text-sub)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
          &ldquo;{quote.text}&rdquo;
        </p>
        <p style={{ fontSize: isMobile ? 11 : 15, color: 'var(--text-muted)', margin: isMobile ? '6px 0 0' : '10px 0 0' }}>— {quote.author}</p>
      </div>

      {/* Monthly Milestone */}
      <IncomeGoal
        month={monthStr}
        currentPnl={netPnl}
        goal={goalAmount}
        onSetGoal={amount => onSetGoal(monthStr, amount)}
      />

      {/* Calendar — month nav lives inside the component */}
      <MonthCalendar
        year={year}
        month={month}
        trades={allTrades}
        journalEntries={journalEntries}
        diaryDates={diaryDates}
        onDayClick={date => {
          const entry = journalEntries.find(e => e.date === date)
          if (entry) setPopupDate(date)
        }}
        onDiaryClick={onNavigateToDiary}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />

      {/* Charts */}
      <DashboardCharts
        allTrades={allTrades}
        monthTrades={monthTrades}
        journalEntries={journalEntries}
      />

      {/* Recent Trades */}
      {(() => {
        const recentTrades = journalEntries
          .flatMap(e => e.trades.map(t => ({ trade: t, date: e.date })))
          .sort((a, b) => b.date.localeCompare(a.date))
        if (recentTrades.length === 0) return null

        const RESULT_BG: Record<string, { bg: string; border: string; color: string }> = {
          Win:  { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  color: '#22c55e' },
          Loss: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', color: '#ef4444' },
          BE:   { bg: 'rgba(255,255,255,0.03)', border: 'var(--border-mid)',        color: '#aaaaaa' },
          "Didn't take":{ bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', color: '#fb923c' },
        }

        return (
          <div style={{ background: 'var(--card-sheen), var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: isMobile ? '12px 12px 10px' : '20px 20px 16px', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: 'var(--text-muted)', margin: isMobile ? '0 0 10px' : '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Recent Trades
            </h3>

            {/* Column headers — desktop only */}
            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: '110px 70px 70px 1fr 80px', gap: 12, padding: '0 14px 8px', marginBottom: 4, borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Contract', 'Result', 'P&L', 'R:R'].map(h => (
                  <span key={h} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {recentTrades.map(({ trade: t, date }, idx) => {
                const pnl = parseFloat(t.pnl) || 0
                const pnlColor = pnl > 0 ? '#22c55e' : pnl < 0 ? '#ef4444' : 'var(--text-sub)'
                const rrVal = (() => {
                  const tp = parseFloat(t.takeProfit), sl = parseFloat(t.stopLoss)
                  if (isNaN(tp) || isNaN(sl) || tp === 0 || sl === 0) return null
                  return (tp / sl).toFixed(2)
                })()
                const rrColor = rrVal ? (parseFloat(rrVal) >= 1 ? '#22c55e' : '#ef4444') : 'var(--text-muted)'
                const style = RESULT_BG[t.result] ?? RESULT_BG.BE
                const dateShort = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                return isMobile ? (
                  <div
                    key={`${date}-${t.id}-${idx}`}
                    onClick={() => setRecentTradePopup({ trade: t, date })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
                      background: style.bg, border: `1px solid ${style.border}`,
                      cursor: 'pointer', boxShadow: 'var(--shadow-inset-top)',
                      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm), var(--shadow-inset-top)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-inset-top)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-label)' }}>{t.symbol || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{dateShort}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: pnlColor }}>
                      {t.pnl ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '—'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: style.color, minWidth: 40, textAlign: 'right' }}>{t.result}</span>
                  </div>
                ) : (
                  <div
                    key={`${date}-${t.id}-${idx}`}
                    onClick={() => setRecentTradePopup({ trade: t, date })}
                    style={{
                      display: 'grid', gridTemplateColumns: '110px 70px 70px 1fr 80px',
                      gap: 12, padding: '9px 14px', borderRadius: 8,
                      background: style.bg, border: `1px solid ${style.border}`,
                      alignItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-inset-top)',
                      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm), var(--shadow-inset-top)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-inset-top)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>{dateShort}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-label)' }}>{t.symbol || '—'}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: style.color }}>{t.result}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: pnlColor }}>
                      {t.pnl ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '—'}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: rrColor }}>
                      {rrVal ? `${rrVal}R` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Recent trade detail popup */}
      {recentTradePopup && (() => {
        const { trade: t, date } = recentTradePopup
        const tradePnl = parseFloat(t.pnl) || 0
        const rrVal = (() => {
          const tp = parseFloat(t.takeProfit), sl = parseFloat(t.stopLoss)
          if (isNaN(tp) || isNaN(sl) || tp === 0 || sl === 0) return null
          return (tp / sl).toFixed(2)
        })()
        const rrPositive = rrVal ? parseFloat(rrVal) >= 1 : null
        const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        const showDrawdown = t.drawdown && ['Win', 'BE', "Didn't take"].includes(t.result)
        const priceFields = [
          { label: 'Entry', val: t.entryPrice },
          { label: 'Exit', val: t.exitPrice },
          { label: 'Take Profit', val: t.takeProfit },
          { label: 'Stop Loss', val: t.stopLoss },
        ].filter(f => f.val)
        const secLabel: React.CSSProperties = { fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px' }}
            onClick={() => setRecentTradePopup(null)}
          >
            <div
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{dateLabel}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: RESULT_COLORS[t.result] || 'var(--text-sub)', background: `${RESULT_COLORS[t.result]}1a`, padding: '3px 9px', borderRadius: 6 }}>{t.result}</span>
                    {t.symbol && <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{t.symbol}</span>}
                    <span style={{ fontSize: 15, color: t.side === 'Long' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{t.side}</span>
                    {t.contracts && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.contracts} contracts</span>}
                    {t.accounts.map(a => (
                      <span key={a} style={{ fontSize: 13, color: 'var(--text-sub)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '2px 7px', borderRadius: 5, fontWeight: 600 }}>{a}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setRecentTradePopup(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4, transition: 'color 0.15s', flexShrink: 0, marginLeft: 12 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                ><X size={18} /></button>
              </div>
              {/* Body */}
              <div style={{ overflowY: 'auto', padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {priceFields.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {priceFields.map(f => (
                      <div key={f.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ ...secLabel, marginBottom: 3 }}>{f.label}</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-label)' }}>{f.val}</div>
                      </div>
                    ))}
                  </div>
                )}
                {(t.pnl || rrVal) && (
                  <div style={{ display: 'grid', gridTemplateColumns: t.pnl && rrVal ? '2fr 1fr' : '1fr', gap: 6 }}>
                    {t.pnl && (
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={secLabel}>P&L</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: tradePnl > 0 ? '#22c55e' : tradePnl < 0 ? '#ef4444' : 'var(--text-sub)' }}>{tradePnl >= 0 ? '+' : ''}{formatCurrency(tradePnl)}</div>
                      </div>
                    )}
                    {rrVal && (
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={secLabel}>R:R</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: rrPositive ? '#22c55e' : rrPositive === false ? '#ef4444' : 'var(--text-label)' }}>{rrVal}R</div>
                      </div>
                    )}
                  </div>
                )}
                {showDrawdown && (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={secLabel}>Drawdown</span>
                    <span style={{ fontSize: 16, color: 'var(--text-sub)', fontWeight: 600 }}>{t.drawdown} pts</span>
                  </div>
                )}
                {t.sessions.length > 0 && (
                  <div>
                    <div style={secLabel}>Session</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {t.sessions.map(s => <span key={s} style={{ fontSize: 14, color: 'var(--text-sub)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '3px 9px', borderRadius: 6 }}>{s}</span>)}
                    </div>
                  </div>
                )}
                {t.dol.length > 0 && (
                  <div>
                    <div style={secLabel}>Draw on Liquidity</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {t.dol.map(d => <span key={d} style={{ fontSize: 14, color: 'var(--text-sub)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '3px 9px', borderRadius: 6 }}>{d}</span>)}
                    </div>
                  </div>
                )}
                {t.confluences.length > 0 && (
                  <div>
                    <div style={secLabel}>Confluences</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {t.confluences.map(c => <span key={c} style={{ fontSize: 14, color: 'var(--text-label)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '3px 9px', borderRadius: 6 }}>{c}</span>)}
                    </div>
                  </div>
                )}
                {t.htfImgKey && (
                  <div>
                    <div style={secLabel}>HTF Chart</div>
                    <img src={t.htfImgKey} alt="HTF chart" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', maxHeight: 220 }} />
                  </div>
                )}
                {t.execImgKey && (
                  <div>
                    <div style={secLabel}>Execution Chart</div>
                    <img src={t.execImgKey} alt="Execution chart" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', maxHeight: 220 }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Day detail popup */}
      {popupDate && (() => {
        const entry = journalEntries.find(e => e.date === popupDate)
        if (!entry) return null
        const dayPnl = entry.trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0)
        const pnlColor = dayPnl > 0 ? '#22c55e' : dayPnl < 0 ? '#ef4444' : 'var(--text-sub)'
        const em = entry.emotion ? EMOTION_DISPLAY[entry.emotion] : null
        const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        const rulesPct = tradingRules.length === 0 ? 0 : Math.round(
          (entry.rulesFollowed.filter(id => tradingRules.some(r => r.id === id)).length / tradingRules.length) * 100
        )
        const barColor = rulesPct <= 33 ? '#ef4444' : rulesPct <= 66 ? '#fbbf24' : '#22c55e'
        const secLabel = { fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px' }}
            onClick={() => setPopupDate(null)}
          >
            <div
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '96vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Popup header */}
              <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{dateLabel}</div>
                  {entry.trades.length > 0 && (
                    <div style={{ fontSize: 24, fontWeight: 700, color: pnlColor }}>
                      {dayPnl >= 0 ? '+' : ''}{formatCurrency(dayPnl)}
                      <span style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                        {entry.trades.length} trade{entry.trades.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  {em && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 24, lineHeight: 1 }}>{em.emoji}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{em.label}</span>
                    </div>
                  )}
                  <button
                    onClick={() => { setPopupDate(null); onNavigateToJournal(popupDate) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-label)', fontSize: 14, fontWeight: 600, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-label)' }}
                  >
                    <NotebookPen size={13} />
                    Edit Day
                  </button>
                  <button
                    onClick={() => setPopupDate(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                  ><X size={18} /></button>
                </div>
              </div>

              {/* Popup body — scrollable */}
              <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Red folder news */}
                {entry.redFolderNews && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10 }}>
                    <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24', marginBottom: entry.redFolderNewsText ? 6 : 0 }}>Red Folder News</div>
                      {entry.redFolderNewsText && <p style={{ fontSize: 15, color: 'var(--text-sub)', margin: 0, lineHeight: 1.6 }}>{entry.redFolderNewsText}</p>}
                    </div>
                  </div>
                )}

                {/* Pre-market analysis */}
                {(entry.premktAnalysis || entry.premktImgKey) && (
                  <div>
                    <div style={secLabel}>Pre-Market Analysis</div>
                    {entry.premktImgKey && (
                      <img src={entry.premktImgKey} alt="Pre-market chart" style={{ width: '100%', borderRadius: 10, marginBottom: entry.premktAnalysis ? 10 : 0, border: '1px solid var(--border)', objectFit: 'contain', maxHeight: 260 }} />
                    )}
                    {entry.premktAnalysis && (
                      <p style={{ fontSize: 15, color: 'var(--text-sub)', margin: 0, lineHeight: 1.7 }}>{entry.premktAnalysis}</p>
                    )}
                  </div>
                )}

                {/* Trades */}
                {entry.trades.length > 0 && (
                  <div>
                    <div style={secLabel}>Trades</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {entry.trades.map(t => {
                        const tradePnl = parseFloat(t.pnl) || 0
                        const rrVal = (() => {
                          const tp = parseFloat(t.takeProfit), sl = parseFloat(t.stopLoss)
                          if (isNaN(tp) || isNaN(sl) || tp === 0 || sl === 0) return null
                          return (tp / sl).toFixed(2)
                        })()
                        const rrPositive = rrVal ? parseFloat(rrVal) >= 1 : null
                        const showDrawdown = t.drawdown && ['Win', 'BE', "Didn't take"].includes(t.result)
                        const priceFields = [
                          { label: 'Entry', val: t.entryPrice },
                          { label: 'Exit', val: t.exitPrice },
                          { label: 'Take Profit', val: t.takeProfit },
                          { label: 'Stop Loss', val: t.stopLoss },
                        ].filter(f => f.val)
                        return (
                          <div key={t.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                            {/* Trade header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: RESULT_COLORS[t.result] || 'var(--text-sub)', background: `${RESULT_COLORS[t.result]}1a`, padding: '3px 9px', borderRadius: 6 }}>{t.result}</span>
                              {t.symbol && <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-label)' }}>{t.symbol}</span>}
                              <span style={{ fontSize: 15, color: t.side === 'Long' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{t.side}</span>
                              {t.contracts && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.contracts} contracts</span>}
                              <div style={{ flex: 1 }} />
                              {t.accounts.map(a => (
                                <span key={a} style={{ fontSize: 13, color: 'var(--text-sub)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '2px 7px', borderRadius: 5, fontWeight: 600 }}>{a}</span>
                              ))}
                            </div>
                            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {/* Price grid */}
                              {priceFields.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                  {priceFields.map(f => (
                                    <div key={f.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                                      <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{f.label}</div>
                                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-label)' }}>{f.val}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* P&L + R:R */}
                              {(t.pnl || rrVal) && (
                                <div style={{ display: 'grid', gridTemplateColumns: t.pnl && rrVal ? '2fr 1fr' : '1fr', gap: 6 }}>
                                  {t.pnl && (
                                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>P&L</div>
                                      <div style={{ fontSize: 18, fontWeight: 700, color: tradePnl > 0 ? '#22c55e' : tradePnl < 0 ? '#ef4444' : 'var(--text-sub)' }}>{tradePnl >= 0 ? '+' : ''}{formatCurrency(tradePnl)}</div>
                                    </div>
                                  )}
                                  {rrVal && (
                                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>R:R</div>
                                      <div style={{ fontSize: 18, fontWeight: 700, color: rrPositive ? '#22c55e' : rrPositive === false ? '#ef4444' : 'var(--text-sub)' }}>{rrVal}R</div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Drawdown */}
                              {showDrawdown && (
                                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Drawdown</span>
                                  <span style={{ fontSize: 16, color: 'var(--text-sub)', fontWeight: 600 }}>{t.drawdown} pts</span>
                                </div>
                              )}
                              {/* Sessions */}
                              {t.sessions.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Session</div>
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {t.sessions.map(s => <span key={s} style={{ fontSize: 14, color: 'var(--text-sub)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '3px 9px', borderRadius: 6 }}>{s}</span>)}
                                  </div>
                                </div>
                              )}
                              {/* DOL */}
                              {t.dol.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Draw on Liquidity</div>
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {t.dol.map(d => <span key={d} style={{ fontSize: 14, color: 'var(--text-sub)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '3px 9px', borderRadius: 6 }}>{d}</span>)}
                                  </div>
                                </div>
                              )}
                              {/* Confluences */}
                              {t.confluences.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Confluences</div>
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {t.confluences.map(c => <span key={c} style={{ fontSize: 14, color: 'var(--text-label)', background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', padding: '3px 9px', borderRadius: 6 }}>{c}</span>)}
                                  </div>
                                </div>
                              )}
                              {/* Screenshots */}
                              {t.htfImgKey && (
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>HTF Chart</div>
                                  <img src={t.htfImgKey} alt="HTF chart" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', maxHeight: 220 }} />
                                </div>
                              )}
                              {t.execImgKey && (
                                <div>
                                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Execution Chart</div>
                                  <img src={t.execImgKey} alt="Execution chart" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', maxHeight: 220 }} />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Trading rules */}
                {tradingRules.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={secLabel}>Trading Rules</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: barColor }}>{rulesPct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ width: `${rulesPct}%`, height: '100%', borderRadius: 999, background: barColor }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {tradingRules.map(rule => {
                        const followed = entry.rulesFollowed.includes(rule.id)
                        return (
                          <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg)', borderRadius: 8, border: `1px solid ${followed ? 'rgba(34,197,94,0.2)' : 'var(--border)'}` }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: followed ? 'rgba(34,197,94,0.12)' : 'var(--bg-surface)', border: `1px solid ${followed ? 'rgba(34,197,94,0.4)' : 'var(--border-mid)'}` }}>
                              {followed && <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 15, color: followed ? 'var(--text-label)' : 'var(--text-muted)' }}>{rule.text}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Post-market notes */}
                {entry.postMarketNotes && (
                  <div>
                    <div style={secLabel}>Post Market Notes</div>
                    <p style={{ fontSize: 15, color: 'var(--text-sub)', margin: 0, lineHeight: 1.7 }}>{entry.postMarketNotes}</p>
                  </div>
                )}

              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
