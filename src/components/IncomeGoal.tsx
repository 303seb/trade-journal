import { useState, useEffect } from 'react'
import { Target, Edit2, Check } from 'lucide-react'
import { formatCurrency } from '../utils/stats'

interface IncomeGoalProps {
  month: string
  currentPnl: number
  goal: number
  onSetGoal: (amount: number) => void
}

export function IncomeGoal({ month, currentPnl, goal, onSetGoal }: IncomeGoalProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(goal.toString())

  useEffect(() => {
    setInputVal(goal.toString())
  }, [goal])

  const progress = goal > 0 ? Math.min((currentPnl / goal) * 100, 100) : 0
  const remaining = goal - currentPnl
  const isAhead = currentPnl >= goal

  const barColor = progress <= 0
    ? '#1e1e1e'
    : progress <= 33
    ? '#f87171'
    : progress <= 66
    ? '#fbbf24'
    : '#4ade80'

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
    <div style={{ background: '#141414', border: '1px solid #1f1f1f', borderRadius: 16, padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#1a1a1a', border: '1px solid #222',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Target size={17} color="#777" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 }}>Monthly Milestone</div>
            <div style={{ fontSize: 11, color: '#444' }}>{monthLabel}</div>
          </div>
        </div>

        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#555' }}>$</span>
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{
                background: '#0e0e0e', border: '1px solid #333', borderRadius: 8,
                padding: '7px 12px', fontSize: 13, color: '#f0f0f0', width: 130,
                outline: 'none', fontFamily: 'inherit',
              }}
              autoFocus
            />
            <button
              onClick={handleSave}
              style={{
                background: '#f0f0f0', color: '#111', border: 'none', borderRadius: 8,
                padding: '8px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#ffffff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f0f0f0')}
            >
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#555', background: 'none', border: 'none',
              cursor: 'pointer', transition: 'color 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0f0f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            <Edit2 size={13} />
            {goal > 0 ? `Goal: ${formatCurrency(goal)}` : 'Set goal'}
          </button>
        )}
      </div>

      {goal > 0 ? (
        <>
          {/* Current vs goal amounts */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <span style={{
                fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em',
                color: isAhead ? '#4ade80' : '#f0f0f0',
              }}>
                {formatCurrency(currentPnl)}
              </span>
              <span style={{ fontSize: 14, color: '#3a3a3a', marginLeft: 12 }}>
                of {formatCurrency(goal)}
              </span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: barColor }}>
              {progress.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 10, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              width: `${Math.max(progress, 0)}%`, height: '100%', borderRadius: 999,
              background: barColor,
              transition: 'width 0.5s ease, background 0.4s ease',
            }} />
          </div>

          {/* Status label */}
          <div style={{ fontSize: 12, color: isAhead ? '#4ade80' : '#555' }}>
            {isAhead
              ? `+${formatCurrency(currentPnl - goal)} over goal`
              : `${formatCurrency(remaining)} remaining`}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#2a2a2a', fontSize: 13 }}>
          Set a monthly goal to track your progress
        </div>
      )}
    </div>
  )
}
