import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, ImageIcon, X, Search, Save, ChevronDown, BookOpen,
} from 'lucide-react'
import type { JournalEntry, TradeLog, TradeResult, AccountType, TradingRule } from '../types'
import { formatCurrency } from '../utils/stats'

// ── Utilities ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function emptyEntry(date: string): JournalEntry {
  return {
    id: uid(), date,
    premktImgKey: undefined, premktAnalysis: '',
    redFolderNews: false, redFolderNewsText: '',
    trades: [], emotion: undefined,
    postMarketNotes: '', rulesFollowed: '', updatedAt: '',
  } as unknown as JournalEntry
}
function emptyTrade(): TradeLog {
  return {
    id: uid(), result: 'Win', accounts: [],
    symbol: '', side: 'Long', contracts: '',
    entryPrice: '', exitPrice: '', takeProfit: '', stopLoss: '',
    pnl: '', drawdown: '', confluences: [], sessions: [], dol: [],
    htfImgKey: undefined, execImgKey: undefined,
    setup: '', grade: '', time: '',
  }
}
function safeEntry(raw: unknown, date: string): JournalEntry {
  const base = emptyEntry(date)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  return {
    ...base,
    id: typeof r.id === 'string' ? r.id : base.id,
    premktAnalysis: typeof r.premktAnalysis === 'string' ? r.premktAnalysis : '',
    postMarketNotes: typeof r.postMarketNotes === 'string' ? r.postMarketNotes : '',
    emotion: (r.emotion as JournalEntry['emotion']) ?? undefined,
    premktImgKey: typeof r.premktImgKey === 'string' ? r.premktImgKey : undefined,
    redFolderNews: typeof r.redFolderNews === 'boolean' ? r.redFolderNews : false,
    redFolderNewsText: typeof r.redFolderNewsText === 'string' ? r.redFolderNewsText : '',
    rulesFollowed: Array.isArray(r.rulesFollowed) ? (r.rulesFollowed as string[]) : [],
    trades: Array.isArray(r.trades) ? (r.trades as TradeLog[]).map(t => ({ ...emptyTrade(), ...t })) : [],
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
  }
}

// ── Auto P&L ──────────────────────────────────────────────────────────────────

const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }

function calcTradePnl(symbol: string, side: 'Long' | 'Short', entry: string, exit: string, contracts: string): string {
  const pv = PVMAP[symbol]
  const e = parseFloat(entry), x = parseFloat(exit), c = parseFloat(contracts)
  if (!pv || isNaN(e) || isNaN(x) || isNaN(c) || c <= 0 || e === 0 || x === 0) return ''
  return ((side === 'Long' ? x - e : e - x) * pv * c).toFixed(2)
}

function calcRR(tp: string, sl: string): string {
  const t = parseFloat(tp), s = parseFloat(sl)
  if (isNaN(t) || isNaN(s) || t === 0 || s === 0) return ''
  return (t / s).toFixed(2)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = ['NQ', 'ES', 'GC', 'MNQ', 'MES', 'MGC']

const CONFLUENCE_BASES = ['Rejection Block', 'Order Block', 'FVG', 'iFVG', 'CISD', 'BPR', 'STDV', 'OTE']
const TIMEFRAMES = ['1m', '2m', '3m', '4m', '5m', '15m', '30m', '1hr', '4hr', 'Daily']
const STDV_LEVELS = ['+0.5', '+1', '+1.5', '+2', '+2.5', '-0.5', '-1', '-1.5', '-2', '-2.5']

const RESULTS: { value: TradeResult; label: string; color: string; activeBg: string }[] = [
  { value: 'Win',   label: 'Win',   color: '#4ade80', activeBg: 'rgba(74,222,128,0.12)'  },
  { value: 'Loss',  label: 'Loss',  color: '#f87171', activeBg: 'rgba(248,113,113,0.12)' },
  { value: 'BE',    label: 'BE',    color: '#aaaaaa', activeBg: 'rgba(170,170,170,0.1)'  },
  { value: 'Faded', label: 'Faded', color: '#fb923c', activeBg: 'rgba(251,146,60,0.1)'   },
]

const RESULT_COLORS: Record<string, string> = {
  Win: '#4ade80', Loss: '#f87171', BE: '#aaaaaa', Faded: '#fb923c',
}

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F']
const GRADE_COLORS: Record<string, string> = {
  'A+': '#4ade80', A: '#86efac', B: '#fbbf24', C: '#fb923c', D: '#f87171', F: '#ef4444',
}

const ACCOUNT_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'Live',   label: 'Live'   },
  { value: 'Funded', label: 'Funded' },
  { value: 'Eval',   label: 'Eval'   },
]

const SESSION_OPTIONS = [
  { value: 'Asia',          label: 'Asia'          },
  { value: 'London',        label: 'London'        },
  { value: 'London Open',   label: 'London Open'   },
  { value: 'London Close',  label: 'London Close'  },
  { value: 'NY',            label: 'New York'      },
  { value: 'NY Open',       label: 'NY Open'       },
  { value: 'NY Lunch',      label: 'NY Lunch'      },
  { value: '9:30 Open',     label: '9:30 Open'     },
  { value: 'Midnight Open', label: 'Midnight Open' },
]

const DOL_OPTIONS = [
  'Asia High', 'Asia Low', 'London High', 'London Low',
  'Equal Highs', 'Equal Lows', 'HTF PD Array',
  'Previous Day High', 'Previous Day Low',
  'Weekly High', 'Weekly Low', 'Daily Open',
]

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 8,
  padding: '8px 11px', fontSize: 13, color: '#e0e0e0', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}

const secLabel = (text: string) => (
  <div style={{ fontSize: 10, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{text}</div>
)

// ── Screenshot Upload ─────────────────────────────────────────────────────────

function ScreenshotUpload({ label, preview, onFile, onClear }: {
  label: string; preview: string | null; onFile: (url: string) => void; onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => { if (typeof e.target?.result === 'string') onFile(e.target.result) }
    reader.readAsDataURL(file)
  }
  return (
    <div>
      {secLabel(label)}
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #222' }}>
          <img src={preview} alt={label} style={{ width: '100%', maxHeight: 140, objectFit: 'contain', background: '#000', display: 'block' }} />
          <button onClick={onClear}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.75)')}
          ><X size={10} /></button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed #1a1a1a', borderRadius: 8, padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
        >
          <ImageIcon size={14} color="#2a2a2a" />
          <span style={{ fontSize: 10, color: '#2a2a2a' }}>Click or drag</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Trade Editor Panel ────────────────────────────────────────────────────────

interface EditorProps {
  trade: TradeLog
  date: string
  isNew: boolean
  saved: boolean
  onUpdate: (t: TradeLog) => void
  onDateChange: (d: string) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

function TradeEditorPanel({ trade, date, isNew, saved, onUpdate, onDateChange, onSave, onDelete, onClose }: EditorProps) {
  const [activePicker, setActivePicker] = useState<string | null>(null)
  const [htfPreview, setHtfPreview] = useState<string | null>(trade.htfImgKey?.startsWith('data:') ? trade.htfImgKey : null)
  const [execPreview, setExecPreview] = useState<string | null>(trade.execImgKey?.startsWith('data:') ? trade.execImgKey : null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => {
    const next = { ...trade, [k]: v }
    if (['symbol', 'side', 'entryPrice', 'exitPrice', 'contracts'].includes(k as string)) {
      next.pnl = calcTradePnl(next.symbol, next.side, next.entryPrice, next.exitPrice, next.contracts)
    }
    onUpdate(next)
  }

  const toggleAccount = (a: AccountType) => {
    const list = trade.accounts || []
    set('accounts', list.includes(a) ? list.filter(x => x !== a) : [...list, a])
  }
  const toggleSession = (s: string) => {
    const list = trade.sessions || []
    set('sessions', list.includes(s) ? list.filter(x => x !== s) : [...list, s])
  }
  const toggleDol = (d: string) => {
    const list = trade.dol || []
    set('dol', list.includes(d) ? list.filter(x => x !== d) : [...list, d])
  }
  const toggleConfluence = (tag: string) => {
    set('confluences', trade.confluences.includes(tag)
      ? trade.confluences.filter(t => t !== tag)
      : [...trade.confluences, tag])
  }

  const pnlVal = parseFloat(trade.pnl)
  const pnlColor = pnlVal > 0 ? '#4ade80' : pnlVal < 0 ? '#f87171' : '#888'
  const hasPnl = trade.pnl !== ''
  const rrVal = calcRR(trade.takeProfit, trade.stopLoss)
  const rrColor = !rrVal ? '#2a2a2a' : parseFloat(rrVal) >= 1 ? '#4ade80' : '#f87171'
  const showDrawdown = trade.result === 'Win' || trade.result === 'BE' || trade.result === 'Faded'

  return (
    <div style={{ width: 420, flexShrink: 0, borderLeft: '1px solid #141414', display: 'flex', flexDirection: 'column', background: '#070707', overflow: 'hidden' }}>

      {/* Panel header */}
      <div style={{ flexShrink: 0, padding: '11px 14px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', display: 'flex', padding: 4, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#888')}
          onMouseLeave={e => (e.currentTarget.style.color = '#333')}
        ><X size={15} /></button>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555', flex: 1 }}>{isNew ? 'New Trade' : 'Edit Trade'}</span>
        {!isNew && (
          <button
            onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid ${confirmDelete ? 'rgba(239,68,68,0.4)' : '#1e1e1e'}`, background: confirmDelete ? 'rgba(239,68,68,0.1)' : 'transparent', color: confirmDelete ? '#f87171' : '#444', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!confirmDelete) { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' } }}
            onMouseLeave={e => { if (!confirmDelete) { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' } }}
          ><Trash2 size={11} />{confirmDelete ? 'Confirm?' : 'Delete'}</button>
        )}
        <button onClick={onSave}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: saved ? 'rgba(74,222,128,0.12)' : '#f0f0f0', color: saved ? '#4ade80' : '#111', outline: saved ? '1px solid rgba(74,222,128,0.25)' : 'none', transition: 'all 0.2s', fontFamily: 'inherit' }}
        ><Save size={12} />{saved ? 'Saved!' : 'Save'}</button>
      </div>

      {/* Date + Time */}
      <div style={{ flexShrink: 0, padding: '10px 14px', borderBottom: '1px solid #0e0e0e', display: 'flex', gap: 10 }}>
        <div style={{ flex: 2 }}>
          {secLabel('Date')}
          <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
            style={inputBase}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          />
        </div>
        <div style={{ flex: 1 }}>
          {secLabel('Time')}
          <input type="time" value={trade.time || ''} onChange={e => set('time', e.target.value)}
            style={inputBase}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Result */}
        <div>
          {secLabel('Result')}
          <div style={{ display: 'flex', gap: 5 }}>
            {RESULTS.map(r => {
              const active = trade.result === r.value
              return (
                <button key={r.value} onClick={() => set('result', r.value)} style={{
                  flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${active ? r.color + '55' : '#1e1e1e'}`,
                  background: active ? r.activeBg : 'transparent',
                  color: active ? r.color : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
                >{r.label}</button>
              )
            })}
          </div>
        </div>

        {/* Grade */}
        <div>
          {secLabel('Grade')}
          <div style={{ display: 'flex', gap: 5 }}>
            {GRADES.map(g => {
              const active = trade.grade === g
              const c = GRADE_COLORS[g] || '#888'
              return (
                <button key={g} onClick={() => set('grade', active ? '' : g)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  border: `1px solid ${active ? c + '55' : '#1e1e1e'}`,
                  background: active ? `${c}18` : 'transparent',
                  color: active ? c : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
                >{g}</button>
              )
            })}
          </div>
        </div>

        {/* Account */}
        <div>
          {secLabel('Account')}
          <div style={{ display: 'flex', gap: 5 }}>
            {ACCOUNT_OPTIONS.map(a => {
              const active = (trade.accounts || []).includes(a.value)
              return (
                <button key={a.value} onClick={() => toggleAccount(a.value)} style={{
                  flex: 1, padding: '7px 8px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${active ? '#3a3a3a' : '#1a1a1a'}`,
                  background: active ? '#1e1e1e' : 'transparent',
                  color: active ? '#e0e0e0' : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
                >{a.label}</button>
              )
            })}
          </div>
        </div>

        {/* Symbol + Direction + Contracts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Symbol</label>
            <select value={trade.symbol} onChange={e => set('symbol', e.target.value)}
              style={{ ...inputBase, cursor: 'pointer' }}
              onFocus={e => (e.target.style.borderColor = '#333')}
              onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
            >
              <option value="">Select…</option>
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Direction</label>
            <div style={{ display: 'flex', gap: 5, height: 36 }}>
              {(['Long', 'Short'] as const).map(side => {
                const active = trade.side === side
                const c = side === 'Long' ? '#22d3ee' : '#f87171'
                const bg = side === 'Long' ? 'rgba(34,211,238,0.1)' : 'rgba(248,113,113,0.1)'
                return (
                  <button key={side} onClick={() => set('side', side)} style={{
                    flex: 1, borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? c + '44' : '#1e1e1e'}`,
                    background: active ? bg : 'transparent',
                    color: active ? c : '#3a3a3a',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
                  >{side}</button>
                )
              })}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Contracts</label>
            <input type="number" value={trade.contracts} onChange={e => set('contracts', e.target.value)}
              placeholder="1" min="0" style={inputBase}
              onFocus={e => (e.target.style.borderColor = '#333')}
              onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
            />
          </div>
        </div>

        {/* Setup */}
        <div>
          <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Setup</label>
          <input
            value={trade.setup || ''}
            onChange={e => set('setup', e.target.value)}
            placeholder="e.g. 5m FVG entry, OB retest, Rejection block…"
            style={inputBase}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          />
        </div>

        {/* Entry / Exit / TP / SL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {([
            { key: 'entryPrice' as const, label: 'Entry Price' },
            { key: 'exitPrice'  as const, label: 'Exit Price'  },
            { key: 'takeProfit' as const, label: 'TP (pts)'    },
            { key: 'stopLoss'   as const, label: 'SL (pts)'    },
          ]).map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
              <input type="number" value={trade[f.key]} onChange={e => set(f.key, e.target.value)}
                placeholder="0.00" style={inputBase}
                onFocus={e => (e.target.style.borderColor = '#333')}
                onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
              />
            </div>
          ))}
        </div>

        {/* Calculated P&L + R:R */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0d0d0d', borderRadius: 10, border: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Calc P&L</span>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: hasPnl ? pnlColor : '#2a2a2a' }}>
              {hasPnl ? (pnlVal >= 0 ? '+' : '') + formatCurrency(pnlVal) : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#0d0d0d', borderRadius: 10, border: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>R:R</span>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: rrColor }}>
              {rrVal ? `${rrVal}R` : '—'}
            </span>
          </div>
        </div>

        {/* Drawdown */}
        {showDrawdown && (
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Drawdown (pts)</label>
            <input type="number" value={trade.drawdown} onChange={e => set('drawdown', e.target.value)}
              placeholder="0.00" min="0" step="0.25" style={inputBase}
              onFocus={e => (e.target.style.borderColor = '#333')}
              onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
            />
          </div>
        )}

        {/* Session */}
        <div>
          {secLabel('Session')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {SESSION_OPTIONS.map(s => {
              const active = trade.sessions.includes(s.value)
              return (
                <button key={s.value} onClick={() => toggleSession(s.value)} style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${active ? '#3a3a3a' : '#1a1a1a'}`,
                  background: active ? '#1e1e1e' : 'transparent',
                  color: active ? '#d0d0d0' : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#2a2a2a' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = '#1a1a1a' } }}
                >{s.label}</button>
              )
            })}
          </div>
        </div>

        {/* Confluences */}
        <div>
          {secLabel('Confluences')}
          {trade.confluences.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {trade.confluences.map(tag => (
                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 11, background: '#1e1e1e', border: '1px solid #333', color: '#d0d0d0' }}>
                  {tag}
                  <button onClick={() => toggleConfluence(tag)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#555', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                  ><X size={9} /></button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: activePicker ? 8 : 0 }}>
            {CONFLUENCE_BASES.map(base => {
              const hasAny = trade.confluences.some(c => c.startsWith(`${base} (`))
              const isOpen = activePicker === base
              return (
                <button key={base} onClick={() => setActivePicker(isOpen ? null : base)} style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${hasAny || isOpen ? '#3a3a3a' : '#1a1a1a'}`,
                  background: hasAny || isOpen ? '#1e1e1e' : 'transparent',
                  color: hasAny || isOpen ? '#d0d0d0' : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                  onMouseEnter={e => { if (!hasAny && !isOpen) { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#2a2a2a' } }}
                  onMouseLeave={e => { if (!hasAny && !isOpen) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = '#1a1a1a' } }}
                >{base}</button>
              )
            })}
          </div>
          {activePicker && (
            <div style={{ padding: '8px 12px', background: '#111', borderRadius: 10, border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{activePicker} — Timeframe</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {TIMEFRAMES.map(tf => {
                    const combo = `${activePicker} (${tf})`
                    const selected = trade.confluences.includes(combo)
                    return (
                      <button key={tf} onClick={() => toggleConfluence(combo)} style={{
                        padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                        border: `1px solid ${selected ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                        background: selected ? 'rgba(74,222,128,0.1)' : 'transparent',
                        color: selected ? '#4ade80' : '#3a3a3a',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}>{tf}</button>
                    )
                  })}
                </div>
              </div>
              {activePicker === 'STDV' && (
                <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 8 }}>
                  <div style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>STDV Level</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {STDV_LEVELS.map(level => {
                      const tag = `STDV ${level}σ`
                      const selected = trade.confluences.includes(tag)
                      return (
                        <button key={level} onClick={() => toggleConfluence(tag)} style={{
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                          border: `1px solid ${selected ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                          background: selected ? 'rgba(74,222,128,0.1)' : 'transparent',
                          color: selected ? '#4ade80' : '#3a3a3a',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        }}>{level}σ</button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DOL */}
        <div>
          {secLabel('Draw on Liquidity')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {DOL_OPTIONS.map(d => {
              const active = (trade.dol || []).includes(d)
              return (
                <button key={d} onClick={() => toggleDol(d)} style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${active ? '#3a3a3a' : '#1a1a1a'}`,
                  background: active ? '#1e1e1e' : 'transparent',
                  color: active ? '#d0d0d0' : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#2a2a2a' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = '#1a1a1a' } }}
                >{d}</button>
              )
            })}
          </div>
        </div>

        {/* Screenshots */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ScreenshotUpload label="HTF Chart" preview={htfPreview}
            onFile={url => { setHtfPreview(url); set('htfImgKey', url) }}
            onClear={() => { setHtfPreview(null); set('htfImgKey', undefined) }}
          />
          <ScreenshotUpload label="Execution Chart" preview={execPreview}
            onFile={url => { setExecPreview(url); set('execImgKey', url) }}
            onClear={() => { setExecPreview(null); set('execImgKey', undefined) }}
          />
        </div>

      </div>
    </div>
  )
}

// ── Main Journal ──────────────────────────────────────────────────────────────

interface JournalProps {
  entries: JournalEntry[]
  confluenceTags: string[]
  tradingRules: TradingRule[]
  onSave: (entry: JournalEntry) => void
  onDelete: (date: string) => void
  onAddConfluenceTag: (tag: string) => void
  onDeleteConfluenceTag: (tag: string) => void
  onAddTradingRule: (text: string) => void
  onRemoveTradingRule: (id: string) => void
  onUpdateTradingRule: (id: string, text: string) => void
  initialDate?: string
}

export function Journal({ entries, onSave, onDelete, initialDate }: JournalProps) {
  const [search, setSearch] = useState('')
  const [filterResult, setFilterResult] = useState('All')
  const [filterSession, setFilterSession] = useState('All')
  const [filterPnl, setFilterPnl] = useState('All')
  const [editDate, setEditDate] = useState(todayStr())
  const [editTrade, setEditTrade] = useState<TradeLog | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (initialDate) {
      setEditDate(initialDate)
      setEditTrade(emptyTrade())
      setSaved(false)
    }
  }, [initialDate])

  // Flatten all trades from all entries, newest first
  const allTrades = entries
    .flatMap(e => e.trades.map(t => ({ ...t, date: e.date })))
    .sort((a, b) => {
      const dc = b.date.localeCompare(a.date)
      return dc !== 0 ? dc : (b.time || '').localeCompare(a.time || '')
    })

  const filtered = allTrades.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      if (!t.symbol.toLowerCase().includes(q) &&
          !(t.setup || '').toLowerCase().includes(q) &&
          !t.result.toLowerCase().includes(q)) return false
    }
    if (filterResult !== 'All' && t.result !== filterResult) return false
    if (filterSession !== 'All' && !t.sessions.includes(filterSession)) return false
    const pnl = parseFloat(t.pnl) || 0
    if (filterPnl === 'Profitable' && pnl <= 0) return false
    if (filterPnl === 'Unprofitable' && pnl >= 0) return false
    return true
  })

  const isNew = !editTrade || !entries.some(e => e.date === editDate && e.trades.some(t => t.id === editTrade.id))

  const handleSave = () => {
    if (!editTrade) return
    const existingEntry = entries.find(e => e.date === editDate)
    const entry = safeEntry(existingEntry, editDate)
    const exists = entry.trades.some(t => t.id === editTrade.id)
    entry.trades = exists
      ? entry.trades.map(t => t.id === editTrade.id ? editTrade : t)
      : [...entry.trades, editTrade]
    entry.updatedAt = new Date().toISOString()
    onSave(entry)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDelete = () => {
    if (!editTrade) return
    const existingEntry = entries.find(e => e.date === editDate)
    if (!existingEntry) return
    const entry = safeEntry(existingEntry, editDate)
    entry.trades = entry.trades.filter(t => t.id !== editTrade.id)
    entry.updatedAt = new Date().toISOString()
    if (entry.trades.length === 0) onDelete(editDate)
    else onSave(entry)
    setEditTrade(null)
  }

  const openNew = () => {
    setEditDate(todayStr())
    setEditTrade(emptyTrade())
    setSaved(false)
  }

  const openEdit = (t: TradeLog & { date: string }) => {
    setEditDate(t.date)
    setEditTrade({ ...t })
    setSaved(false)
  }

  const filtersActive = search || filterResult !== 'All' || filterSession !== 'All' || filterPnl !== 'All'

  // Table column template
  const COL = '150px 70px 84px 1fr 130px 110px 70px 76px 56px'

  const hStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#2a2a2a',
    textTransform: 'uppercase', letterSpacing: '0.09em', padding: '9px 0',
  }

  const selectStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#141414' : '#0a0a0a',
    border: `1px solid ${active ? '#2a2a2a' : '#161616'}`,
    borderRadius: 8, padding: '6px 26px 6px 10px',
    fontSize: 12, color: active ? '#ddd' : '#444',
    cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
    appearance: 'none', WebkitAppearance: 'none',
  })

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* ── Left: table ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Filter / action bar */}
        <div style={{ flexShrink: 0, padding: '10px 16px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 8, background: '#070707' }}>
          <span style={{ fontSize: 12, color: '#252525', marginRight: 4, whiteSpace: 'nowrap' }}>Log, scan and review every trade.</span>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#2a2a2a', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search trades…"
              style={{ ...inputBase, paddingLeft: 27, fontSize: 12, width: 170, padding: '6px 10px 6px 27px', borderRadius: 8, background: '#0a0a0a', border: '1px solid #161616' }}
              onFocus={e => (e.target.style.borderColor = '#333')}
              onBlur={e => (e.target.style.borderColor = '#161616')}
            />
          </div>

          {/* New Trade */}
          <button onClick={openNew} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            background: '#f0f0f0', color: '#111', borderRadius: 8, border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f0f0f0')}
          ><Plus size={13} /> New Trade</button>

          {/* Filters */}
          {[
            { label: 'Result',  value: filterResult,  opts: ['All', 'Win', 'Loss', 'BE', 'Faded'],         set: setFilterResult  },
            { label: 'Session', value: filterSession, opts: ['All', 'Asia', 'London', 'NY', 'London Open', 'NY Open'], set: setFilterSession },
            { label: 'P&L',    value: filterPnl,     opts: ['All', 'Profitable', 'Unprofitable'],          set: setFilterPnl     },
          ].map(f => (
            <div key={f.label} style={{ position: 'relative' }}>
              <select value={f.value} onChange={e => f.set(e.target.value)} style={selectStyle(f.value !== 'All')}>
                {f.opts.map(o => <option key={o} value={o}>{f.label}: {o}</option>)}
              </select>
              <ChevronDown size={10} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none' }} />
            </div>
          ))}

          {filtersActive && (
            <button
              onClick={() => { setSearch(''); setFilterResult('All'); setFilterSession('All'); setFilterPnl('All') }}
              style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #1e1e1e', borderRadius: 8, color: '#444', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' }}
            >Clear</button>
          )}
        </div>

        {/* Column headers */}
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: COL, padding: '0 16px', background: '#060606', borderBottom: '1px solid #0e0e0e' }}>
          {['Date', 'Pair', 'Direction', 'Setup', 'Session', 'Net P&L', 'R', 'Result', 'Grade'].map(h => (
            <div key={h} style={hStyle}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 0', gap: 12 }}>
              <BookOpen size={30} color="#1a1a1a" />
              <p style={{ color: '#1e1e1e', fontSize: 13, margin: 0 }}>
                {allTrades.length === 0 ? 'No trades yet — click New Trade to add one' : 'No trades match your filters'}
              </p>
            </div>
          ) : (
            filtered.map((t, idx) => {
              const pnl = parseFloat(t.pnl) || 0
              const pnlColor = pnl > 0 ? '#4ade80' : pnl < 0 ? '#f87171' : '#555'
              const rrVal = calcRR(t.takeProfit, t.stopLoss)
              const rrNum = rrVal ? parseFloat(rrVal) : null
              const rrColor = rrNum === null ? '#333' : rrNum >= 1 ? '#4ade80' : '#f87171'
              const rc = RESULT_COLORS[t.result] || '#888'
              const gc = t.grade ? (GRADE_COLORS[t.grade] || '#888') : null
              const isEditing = editTrade?.id === t.id && editDate === t.date
              const rowBg = isEditing ? '#111' : idx % 2 === 0 ? '#080808' : '#070707'
              const dateLabel = `${t.date.slice(5).replace('-', '/')}${t.time ? ' · ' + t.time : ''}`
              const sessionLabel = t.sessions.length > 0 ? t.sessions.join(', ') : '—'
              const setupLabel = t.setup || (t.confluences[0] || '—')

              return (
                <div
                  key={`${t.date}-${t.id}-${idx}`}
                  onClick={() => openEdit(t)}
                  style={{
                    display: 'grid', gridTemplateColumns: COL,
                    padding: '10px 16px', background: rowBg,
                    borderBottom: '1px solid #0c0c0c',
                    borderLeft: `2px solid ${isEditing ? '#2a2a2a' : 'transparent'}`,
                    cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center',
                  }}
                  onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = '#0e0e0e' }}
                  onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
                >
                  <span style={{ fontSize: 11, color: '#444', fontWeight: 500 }}>{dateLabel}</span>

                  <span style={{ fontSize: 13, fontWeight: 700, color: '#bbb' }}>{t.symbol || '—'}</span>

                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, width: 'fit-content',
                    background: t.side === 'Long' ? 'rgba(34,211,238,0.12)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${t.side === 'Long' ? 'rgba(34,211,238,0.25)' : 'rgba(248,113,113,0.2)'}`,
                    color: t.side === 'Long' ? '#22d3ee' : '#f87171',
                  }}>{t.side}</span>

                  <span style={{ fontSize: 12, color: '#3a3a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10 }}>{setupLabel}</span>

                  <span style={{ fontSize: 11, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sessionLabel}</span>

                  <span style={{ fontSize: 13, fontWeight: 700, color: pnlColor }}>
                    {t.pnl ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '—'}
                  </span>

                  <span style={{ fontSize: 12, fontWeight: 700, color: rrColor }}>
                    {rrVal ? `${rrNum! >= 0 ? '+' : ''}${rrVal}R` : '—'}
                  </span>

                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, width: 'fit-content',
                    background: `${rc}18`, border: `1px solid ${rc}44`, color: rc,
                  }}>{t.result}</span>

                  {gc ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, width: 'fit-content',
                      background: `${gc}18`, border: `1px solid ${gc}44`, color: gc,
                    }}>{t.grade}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#1e1e1e' }}>—</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right: editor panel ── */}
      {editTrade && (
        <TradeEditorPanel
          trade={editTrade}
          date={editDate}
          isNew={isNew}
          saved={saved}
          onUpdate={t => setEditTrade(t)}
          onDateChange={d => setEditDate(d)}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditTrade(null)}
        />
      )}
    </div>
  )
}
