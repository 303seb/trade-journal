import { useState, useRef, useEffect } from 'react'
import { ChevronDown, SlidersHorizontal, Calendar, Wallet } from 'lucide-react'
import type { MoneyUnit } from '../utils/units'

export type RangeKey = 'all' | 'ytd' | 'month' | '30d'

export interface Controls {
  unit: MoneyUnit
  range: RangeKey
  account: string   // 'all' or account name
  result: string    // 'all' | 'Win' | 'Loss' | 'BE' | "Didn't take"
  symbol: string    // 'all' or symbol
}

export const DEFAULT_CONTROLS: Controls = { unit: 'dollars', range: 'all', account: 'all', result: 'all', symbol: 'all' }

const RANGE_OPTS: { v: RangeKey; l: string }[] = [
  { v: 'all', l: 'All time' }, { v: 'ytd', l: 'This year' }, { v: 'month', l: 'This month' }, { v: '30d', l: 'Last 30 days' },
]
const RESULT_OPTS = ['all', 'Win', 'Loss', 'BE', "Didn't take"]

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return { open, setOpen, ref }
}

const trigger: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
  border: '1px solid var(--border-mid)', background: 'var(--bg-card)', color: 'var(--text-sub)',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const panel: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 45, background: 'var(--bg-panel)',
  border: '1px solid var(--border-strong)', borderRadius: 11, boxShadow: 'var(--shadow-card)', padding: 6, minWidth: 176,
}
const rowBtn = (active: boolean): React.CSSProperties => ({
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none',
  background: active ? 'var(--bg-active)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-sub)',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
})

function Field({ label }: { label: string }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px 4px' }}>{label}</div>
}

export function ControlBar({ value, onChange, accountNames, symbols }: {
  value: Controls
  onChange: (next: Controls) => void
  accountNames: string[]
  symbols: string[]
}) {
  const filters = usePopover()
  const dates = usePopover()
  const accts = usePopover()
  const set = (patch: Partial<Controls>) => onChange({ ...value, ...patch })

  const activeFilters = (value.result !== 'all' ? 1 : 0) + (value.symbol !== 'all' ? 1 : 0)
  const rangeLabel = RANGE_OPTS.find(o => o.v === value.range)?.l ?? 'Date range'
  const acctLabel = value.account === 'all' ? 'All accounts' : value.account

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* Money unit segmented control */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 9, padding: 3, gap: 2 }}>
        {(['dollars', 'ticks', 'rr'] as MoneyUnit[]).map(u => (
          <button key={u} onClick={() => set({ unit: u })}
            style={{ padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              background: value.unit === u ? 'var(--btn-bg)' : 'transparent', color: value.unit === u ? 'var(--btn-text)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {u === 'dollars' ? 'Dollars' : u === 'ticks' ? 'Ticks' : 'R:R'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div ref={filters.ref} style={{ position: 'relative' }}>
        <button onClick={() => filters.setOpen(!filters.open)} style={trigger}>
          <SlidersHorizontal size={14} /> Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
        </button>
        {filters.open && (
          <div style={{ ...panel, minWidth: 200 }}>
            <Field label="Result" />
            {RESULT_OPTS.map(r => (
              <button key={r} onClick={() => set({ result: r })} style={rowBtn(value.result === r)}
                onMouseEnter={e => { if (value.result !== r) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (value.result !== r) e.currentTarget.style.background = 'transparent' }}>
                {r === 'all' ? 'All results' : r}
              </button>
            ))}
            {symbols.length > 0 && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                <Field label="Symbol" />
                <div style={{ maxHeight: 168, overflowY: 'auto' }}>
                  <button onClick={() => set({ symbol: 'all' })} style={rowBtn(value.symbol === 'all')}
                    onMouseEnter={e => { if (value.symbol !== 'all') e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (value.symbol !== 'all') e.currentTarget.style.background = 'transparent' }}>All symbols</button>
                  {symbols.map(s => (
                    <button key={s} onClick={() => set({ symbol: s })} style={rowBtn(value.symbol === s)}
                      onMouseEnter={e => { if (value.symbol !== s) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (value.symbol !== s) e.currentTarget.style.background = 'transparent' }}>{s}</button>
                  ))}
                </div>
              </>
            )}
            {activeFilters > 0 && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                <button onClick={() => set({ result: 'all', symbol: 'all' })} style={{ ...rowBtn(false), color: 'var(--text-muted)' }}>Clear filters</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Date range */}
      <div ref={dates.ref} style={{ position: 'relative' }}>
        <button onClick={() => dates.setOpen(!dates.open)} style={trigger}>
          <Calendar size={14} /> {rangeLabel} <ChevronDown size={13} />
        </button>
        {dates.open && (
          <div style={panel}>
            {RANGE_OPTS.map(o => (
              <button key={o.v} onClick={() => { set({ range: o.v }); dates.setOpen(false) }} style={rowBtn(value.range === o.v)}
                onMouseEnter={e => { if (value.range !== o.v) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (value.range !== o.v) e.currentTarget.style.background = 'transparent' }}>{o.l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Accounts */}
      <div ref={accts.ref} style={{ position: 'relative' }}>
        <button onClick={() => accts.setOpen(!accts.open)} style={trigger}>
          <Wallet size={14} /> {acctLabel} <ChevronDown size={13} />
        </button>
        {accts.open && (
          <div style={panel}>
            <button onClick={() => { set({ account: 'all' }); accts.setOpen(false) }} style={rowBtn(value.account === 'all')}
              onMouseEnter={e => { if (value.account !== 'all') e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (value.account !== 'all') e.currentTarget.style.background = 'transparent' }}>All accounts</button>
            {accountNames.map(a => (
              <button key={a} onClick={() => { set({ account: a }); accts.setOpen(false) }} style={rowBtn(value.account === a)}
                onMouseEnter={e => { if (value.account !== a) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (value.account !== a) e.currentTarget.style.background = 'transparent' }}>{a}</button>
            ))}
            {accountNames.length === 0 && <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--text-dim)' }}>No accounts yet</div>}
          </div>
        )}
      </div>
    </div>
  )
}
