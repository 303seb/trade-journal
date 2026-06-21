import { useState } from 'react'
import { NotebookPen, TrendingUp, DollarSign, BarChart2, Award, Activity, Calendar, X, AlertTriangle } from 'lucide-react'
import { StatCard } from '../components/StatCard'
import { IncomeGoal } from '../components/IncomeGoal'
import { MonthCalendar } from '../components/MonthCalendar'
import {
  getDashTrades,
  getMonthTrades,
  getYearTrades,
  calcNetPnl,
  calcWinRate,
  calcProfitFactor,
  calcAvgRR,
  getDayPnl,
  formatCurrency,
  formatPct,
} from '../utils/stats'
import type { JournalEntry, TradingRule } from '../types'

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
  Win: '#4ade80', Loss: '#f87171', BE: '#aaaaaa', Faded: '#fb923c',
}

interface DashboardProps {
  journalEntries: JournalEntry[]
  monthlyGoals: { month: string; amount: number }[]
  tradingRules: TradingRule[]
  onSetGoal: (month: string, amount: number) => void
  onNavigateToJournal: (date?: string) => void
}

export function Dashboard({ journalEntries, monthlyGoals, tradingRules, onSetGoal, onNavigateToJournal }: DashboardProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [popupDate, setPopupDate] = useState<string | null>(null)

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
  const avgRR = calcAvgRR(monthTrades)
  const goalAmount = monthlyGoals.find(g => g.month === monthStr)?.amount ?? 0

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 28px 32px' }}>

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onNavigateToJournal(todayStr)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
            background: '#f0f0f0', color: '#111', borderRadius: 10, border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#ffffff')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f0f0f0')}
        >
          <NotebookPen size={15} />
          Add Journal Entry
        </button>
      </div>

      {/* Stats — 6 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
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
          label="Avg RR"
          value={avgRR > 0 ? `${avgRR.toFixed(2)}R` : '—'}
          sub="reward / risk"
          positive={avgRR === 0 ? null : avgRR >= 1}
          icon={<Activity size={15} />}
        />
      </div>

      {/* Quote */}
      <div style={{
        background: '#141414', border: '1px solid #1f1f1f', borderRadius: 14,
        padding: '20px 28px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 14, color: '#aaaaaa', fontStyle: 'italic', lineHeight: 1.7, margin: 0 }}>
          &ldquo;{quote.text}&rdquo;
        </p>
        <p style={{ fontSize: 12, color: '#444', margin: '10px 0 0' }}>— {quote.author}</p>
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
        onDayClick={date => {
          const entry = journalEntries.find(e => e.date === date)
          if (entry) setPopupDate(date)
        }}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />

      {/* Day detail popup */}
      {popupDate && (() => {
        const entry = journalEntries.find(e => e.date === popupDate)
        if (!entry) return null
        const dayPnl = entry.trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0)
        const pnlColor = dayPnl > 0 ? '#4ade80' : dayPnl < 0 ? '#f87171' : '#888'
        const em = entry.emotion ? EMOTION_DISPLAY[entry.emotion] : null
        const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        const rulesPct = tradingRules.length === 0 ? 0 : Math.round(
          (entry.rulesFollowed.filter(id => tradingRules.some(r => r.id === id)).length / tradingRules.length) * 100
        )
        const barColor = rulesPct <= 33 ? '#f87171' : rulesPct <= 66 ? '#fbbf24' : '#4ade80'
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setPopupDate(null)}
          >
            <div
              style={{ background: '#111', border: '1px solid #222', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Popup header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>{dateLabel}</div>
                  {entry.trades.length > 0 && (
                    <div style={{ fontSize: 20, fontWeight: 700, color: pnlColor }}>
                      {dayPnl >= 0 ? '+' : ''}{formatCurrency(dayPnl)}
                      <span style={{ fontSize: 12, color: '#555', fontWeight: 400, marginLeft: 8 }}>
                        {entry.trades.length} trade{entry.trades.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {em && <span style={{ fontSize: 26, lineHeight: 1 }}>{em.emoji}</span>}
                  <button onClick={() => setPopupDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', padding: 4, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#e0e0e0')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                  ><X size={18} /></button>
                </div>
              </div>
              {/* Popup body */}
              <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {entry.redFolderNews && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10 }}>
                    <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: entry.redFolderNewsText ? 5 : 0 }}>Red Folder News</div>
                      {entry.redFolderNewsText && <p style={{ fontSize: 12, color: '#999', margin: 0, lineHeight: 1.6 }}>{entry.redFolderNewsText}</p>}
                    </div>
                  </div>
                )}
                {entry.premktAnalysis && (
                  <div>
                    <div style={{ fontSize: 10, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Pre-Market Analysis</div>
                    <p style={{ fontSize: 13, color: '#999', margin: 0, lineHeight: 1.7 }}>{entry.premktAnalysis}</p>
                  </div>
                )}
                {entry.trades.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Trades</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {entry.trades.map(t => {
                        const tradePnl = parseFloat(t.pnl) || 0
                        return (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0d0d0d', borderRadius: 10, border: '1px solid #1a1a1a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: RESULT_COLORS[t.result] || '#888' }}>{t.result}</span>
                              {t.symbol && <span style={{ fontSize: 12, color: '#777' }}>{t.symbol}</span>}
                              <span style={{ fontSize: 11, color: t.side === 'Long' ? '#4ade80' : '#f87171' }}>{t.side}</span>
                              {t.contracts && <span style={{ fontSize: 11, color: '#444' }}>{t.contracts}x</span>}
                            </div>
                            {t.pnl && (
                              <span style={{ fontSize: 13, fontWeight: 700, color: tradePnl > 0 ? '#4ade80' : tradePnl < 0 ? '#f87171' : '#888' }}>
                                {tradePnl >= 0 ? '+' : ''}{formatCurrency(tradePnl)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {tradingRules.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rules Followed</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{rulesPct}%</span>
                    </div>
                    <div style={{ height: 5, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${rulesPct}%`, height: '100%', borderRadius: 999, background: barColor }} />
                    </div>
                  </div>
                )}
                {entry.postMarketNotes && (
                  <div>
                    <div style={{ fontSize: 10, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Post Market Notes</div>
                    <p style={{ fontSize: 13, color: '#999', margin: 0, lineHeight: 1.7 }}>{entry.postMarketNotes}</p>
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
