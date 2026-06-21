import { useState } from 'react'
import { NotebookPen, TrendingUp, DollarSign, BarChart2, Award, Activity, Calendar } from 'lucide-react'
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
import type { JournalEntry } from '../types'

const QUOTES = [
  { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
  { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { text: "Plan the trade and trade the plan.", author: "Unknown" },
  { text: "Amateurs want to be right. Professionals want to make money.", author: "Unknown" },
  { text: "The market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { text: "In trading, the hardest thing is to sit on your hands and do nothing.", author: "Jesse Livermore" },
  { text: "Every loss is a lesson. Every win is confirmation.", author: "Unknown" },
]

interface DashboardProps {
  journalEntries: JournalEntry[]
  monthlyGoals: { month: string; amount: number }[]
  onSetGoal: (month: string, amount: number) => void
  onNavigateToJournal: (date?: string) => void
}

export function Dashboard({ journalEntries, monthlyGoals, onSetGoal, onNavigateToJournal }: DashboardProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

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
        onDayClick={date => onNavigateToJournal(date)}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />

    </div>
  )
}
