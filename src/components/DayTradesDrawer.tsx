import { X, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../utils/stats'
import type { Trade } from '../types'

interface DayTradesDrawerProps {
  date: string
  trades: Trade[]
  onClose: () => void
  onDelete: (id: string) => void
}

export function DayTradesDrawer({ date, trades, onClose, onDelete }: DayTradesDrawerProps) {
  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#141414] border-l border-[#1f1f1f] w-full max-w-md h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#141414] border-b border-[#1f1f1f] p-5 flex items-start justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-[#f0f0f0]">{label}</h2>
            <span className={`text-sm font-bold ${dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {dayPnl >= 0 ? '+' : ''}{formatCurrency(dayPnl)}
            </span>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-[#f0f0f0] transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {trades.length === 0 ? (
            <p className="text-[#444] text-sm text-center py-8">No trades on this day.</p>
          ) : (
            trades.map(trade => (
              <div
                key={trade.id}
                className={`rounded-xl border p-4 ${
                  trade.pnl >= 0
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-red-500/20 bg-red-500/5'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {trade.pnl >= 0 ? (
                      <TrendingUp size={15} className="text-emerald-400" />
                    ) : (
                      <TrendingDown size={15} className="text-red-400" />
                    )}
                    <span className="font-bold text-[#f0f0f0] text-sm">{trade.symbol}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        trade.side === 'Long'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {trade.side}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </span>
                    <button
                      onClick={() => onDelete(trade.id)}
                      className="text-[#444] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-[#888]">
                  <div>
                    <span className="block text-[#555]">Qty</span>
                    <span className="text-[#ccc]">{trade.contracts}</span>
                  </div>
                  <div>
                    <span className="block text-[#555]">Entry</span>
                    <span className="text-[#ccc]">{trade.entryPrice}</span>
                  </div>
                  <div>
                    <span className="block text-[#555]">Exit</span>
                    <span className="text-[#ccc]">{trade.exitPrice}</span>
                  </div>
                </div>

                {trade.notes && (
                  <p className="mt-3 text-xs text-[#666] border-t border-[#1f1f1f] pt-3 leading-relaxed">
                    {trade.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
