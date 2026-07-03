import { useState, useEffect } from 'react'
import { Target, Edit2, Check } from 'lucide-react'
import { formatCurrency } from '../utils/stats'
import { useMobile } from '../hooks/useMobile'

interface IncomeGoalProps {
  month: string
  currentPnl: number
  goal: number
  onSetGoal: (amount: number) => void
}

export function IncomeGoal({ month, currentPnl, goal, onSetGoal }: IncomeGoalProps) {
  const isMobile = useMobile()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(goal.toString())

  useEffect(() => {
    setInputVal(goal.toString())
  }, [goal])

  const progress = goal > 0 ? Math.min((currentPnl / goal) * 100, 100) : 0
  const remaining = goal - currentPnl
  const isAhead = currentPnl >= goal

  const barColor = progress <= 0
    ? 'var(--border)'
    : progress <= 33
    ? '#ef4444'
    : progress <= 66
    ? '#fbbf24'
    : '#22c55e'

  const handleSave = () => {
    const parsed = parseFloat(inputVal.replace(/[^0-9.-]/g, ''))
    if (!isNaN(parsed) && parsed > 0) onSetGoal(parsed)
    setEditing(false)
  }

  const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div style={{ background: 'var(--card-sheen), var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: isMobile ? '14px 14px' : '24px 28px', boxShadow: 'var(--shadow-card)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 14 : 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14 }}>
          {!isMobile && (
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--bg-hover)', border: '1px solid var(--border-mid)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Target size={17} color="var(--text-sub)" />
            </div>
          )}
          <div>
            <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Monthly Milestone</div>
            {!isMobile && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{monthLabel}</div>}
          </div>
        </div>

        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>$</span>
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-strong)', borderRadius: 8,
                padding: isMobile ? '6px 8px' : '7px 12px', fontSize: 14, color: 'var(--text)',
                width: isMobile ? 90 : 130,
                outline: 'none', fontFamily: 'inherit',
              }}
              autoFocus
            />
            <button
              onClick={handleSave}
              style={{
                background: 'var(--btn-bg)', color: 'var(--btn-text)', border: 'none', borderRadius: 8,
                padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-bg)')}
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: isMobile ? 12 : 14, color: 'var(--text-muted)', background: 'none', border: 'none',
              cursor: 'pointer', transition: 'color 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Edit2 size={12} />
            {goal > 0 ? `Goal: ${formatCurrency(goal)}` : 'Set goal'}
          </button>
        )}
      </div>

      {goal > 0 ? (
        <>
          {/* Current vs goal amounts */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: isMobile ? 12 : 18 }}>
            <div>
              <span style={{
                fontSize: isMobile ? 22 : 34, fontWeight: 700, letterSpacing: '-0.03em',
                color: isAhead ? '#22c55e' : 'var(--text)',
              }}>
                {formatCurrency(currentPnl)}
              </span>
              <span style={{ fontSize: isMobile ? 13 : 16, color: 'var(--text-dim)', marginLeft: isMobile ? 8 : 12 }}>
                of {formatCurrency(goal)}
              </span>
            </div>
            <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: barColor }}>
              {progress.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: isMobile ? 8 : 10, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden', marginBottom: isMobile ? 10 : 16, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.35)' }}>
            <div style={{
              width: `${Math.max(progress, 0)}%`, height: '100%', borderRadius: 999,
              background: `linear-gradient(180deg, ${barColor}, ${barColor})`,
              boxShadow: progress > 0 ? `0 0 12px ${barColor}, inset 0 1px 0 rgba(255,255,255,0.25)` : 'none',
              transition: 'width 0.5s ease, background 0.4s ease, box-shadow 0.4s ease',
            }} />
          </div>

          {/* Status label */}
          <div style={{ fontSize: isMobile ? 12 : 14, color: isAhead ? '#22c55e' : 'var(--text-muted)' }}>
            {isAhead
              ? `+${formatCurrency(currentPnl - goal)} over goal`
              : `${formatCurrency(remaining)} remaining`}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: isMobile ? '18px 0' : '32px 0', color: 'var(--text-dim)', fontSize: isMobile ? 13 : 15 }}>
          Set a monthly goal to track your progress
        </div>
      )}
    </div>
  )
}
