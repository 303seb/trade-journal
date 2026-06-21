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
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#888]" />
          <span className="text-sm font-semibold text-[#f0f0f0]">Monthly Milestone</span>
          <span className="text-xs text-[#555]">— {monthLabel}</span>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-[#666] text-sm">$</span>
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="bg-[#0e0e0e] border border-[#333] rounded-lg px-3 py-1 text-sm text-[#f0f0f0] w-32 focus:border-[#555]"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="bg-[#f0f0f0] hover:bg-white text-[#111] rounded-lg p-1.5 transition-colors"
            >
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#f0f0f0] transition-colors"
          >
            <Edit2 size={13} />
            {goal > 0 ? `Goal: ${formatCurrency(goal)}` : 'Set goal'}
          </button>
        )}
      </div>

      {goal > 0 ? (
        <>
          <div className="relative h-3 bg-[#1e1e1e] rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isAhead
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : 'bg-gradient-to-r from-[#444] to-[#666]'
              }`}
              style={{ width: `${Math.max(progress, 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={isAhead ? 'text-emerald-400 font-medium' : 'text-[#666]'}>
              {isAhead
                ? `+${formatCurrency(currentPnl - goal)} over goal`
                : `${formatCurrency(remaining)} remaining`}
            </span>
            <span className={`font-semibold ${isAhead ? 'text-emerald-400' : 'text-[#999]'}`}>
              {progress.toFixed(1)}%
            </span>
          </div>
        </>
      ) : (
        <div className="text-xs text-[#444] text-center py-2">
          Set a monthly goal to track your progress
        </div>
      )}
    </div>
  )
}
