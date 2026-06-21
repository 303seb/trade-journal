import { useState } from 'react'
import { X } from 'lucide-react'
import type { Trade } from '../types'

interface TradeModalProps {
  defaultDate?: string
  onSave: (trade: Omit<Trade, 'id' | 'createdAt'>) => void
  onClose: () => void
}

export function TradeModal({ defaultDate, onSave, onClose }: TradeModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: defaultDate || today,
    symbol: '',
    side: 'Long' as Trade['side'],
    contracts: '1',
    entryPrice: '',
    exitPrice: '',
    notes: '',
  })

  const pnl = (() => {
    const entry = parseFloat(form.entryPrice)
    const exit = parseFloat(form.exitPrice)
    const qty = parseFloat(form.contracts)
    if (isNaN(entry) || isNaN(exit) || isNaN(qty)) return null
    const diff = form.side === 'Long' ? exit - entry : entry - exit
    return diff * qty
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.symbol || !form.entryPrice || !form.exitPrice) return
    onSave({
      date: form.date,
      symbol: form.symbol.toUpperCase(),
      side: form.side,
      contracts: parseFloat(form.contracts) || 1,
      entryPrice: parseFloat(form.entryPrice),
      exitPrice: parseFloat(form.exitPrice),
      pnl: pnl ?? 0,
      notes: form.notes,
    })
    onClose()
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  const inputClass = "w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f0] focus:border-[#555] transition-colors"
  const labelClass = "block text-xs text-[#666] mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#222] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
          <h2 className="text-base font-semibold text-[#f0f0f0]">Add Trade</h2>
          <button onClick={onClose} className="text-[#555] hover:text-[#f0f0f0] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={form.date} onChange={set('date')} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Symbol</label>
              <input
                type="text"
                placeholder="ES, NQ, MES..."
                value={form.symbol}
                onChange={set('symbol')}
                className={inputClass + ' uppercase'}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Side</label>
              <select value={form.side} onChange={set('side')} className={inputClass}>
                <option value="Long">Long</option>
                <option value="Short">Short</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Contracts / Qty</label>
              <input type="number" min="0.01" step="0.01" value={form.contracts} onChange={set('contracts')} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Entry Price</label>
              <input type="number" step="any" placeholder="0.00" value={form.entryPrice} onChange={set('entryPrice')} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Exit Price</label>
              <input type="number" step="any" placeholder="0.00" value={form.exitPrice} onChange={set('exitPrice')} className={inputClass} required />
            </div>
          </div>

          {pnl !== null && (
            <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-center ${
              pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              P&L: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
            </div>
          )}

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              placeholder="Trade setup, mistakes, observations..."
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              className={inputClass + ' resize-none'}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-[#888] hover:text-[#f0f0f0] rounded-lg py-2.5 text-sm font-medium transition-colors border border-[#2a2a2a]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#f0f0f0] hover:bg-white text-[#111] rounded-lg py-2.5 text-sm font-semibold transition-colors"
            >
              Save Trade
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
