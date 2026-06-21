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
    postMarketNotes: '', rulesFollowed: [] as unknown as string, updatedAt: '',
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

// ── P&L + R:R ─────────────────────────────────────────────────────────────────

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

const RESULTS: { value: TradeResult; label: string; color: string; bg: string }[] = [
  { value: 'Win',   label: 'Win',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  { value: 'Loss',  label: 'Loss',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  { value: 'BE',    label: 'BE',    color: '#aaaaaa', bg: 'rgba(170,170,170,0.1)'  },
  { value: 'Faded', label: 'Faded', color: '#fb923c', bg: 'rgba(251,146,60,0.1)'   },
]
const RESULT_COLORS: Record<string, string> = { Win: '#4ade80', Loss: '#f87171', BE: '#aaaaaa', Faded: '#fb923c' }

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F']
const GRADE_COLORS: Record<string, string> = { 'A+': '#4ade80', A: '#86efac', B: '#fbbf24', C: '#fb923c', D: '#f87171', F: '#ef4444' }

const ACCOUNT_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'Live', label: 'Live' }, { value: 'Funded', label: 'Funded' }, { value: 'Eval', label: 'Eval' },
]
const SESSION_OPTIONS = [
  { value: 'Asia', label: 'Asia' }, { value: 'London', label: 'London' },
  { value: 'London Open', label: 'London Open' }, { value: 'London Close', label: 'London Close' },
  { value: 'NY', label: 'New York' }, { value: 'NY Open', label: 'NY Open' },
  { value: 'NY Lunch', label: 'NY Lunch' }, { value: '9:30 Open', label: '9:30 Open' },
  { value: 'Midnight Open', label: 'Midnight Open' },
]
const DOL_OPTIONS = [
  'Asia High', 'Asia Low', 'London High', 'London Low',
  'Equal Highs', 'Equal Lows', 'HTF PD Array',
  'Previous Day High', 'Previous Day Low', 'Weekly High', 'Weekly Low', 'Daily Open',
]

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 8,
  padding: '9px 12px', fontSize: 14, color: '#e0e0e0', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}
const fieldLabel = (text: string) => (
  <div style={{ fontSize: 11, color: '#444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{text}</div>
)

// ── Screenshot Upload ─────────────────────────────────────────────────────────

function ScreenshotUpload({ label, preview, onFile, onClear }: {
  label: string; preview: string | null; onFile: (url: string) => void; onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const handle = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => { if (typeof e.target?.result === 'string') onFile(e.target.result) }
    reader.readAsDataURL(file)
  }
  return (
    <div>
      {fieldLabel(label)}
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #222' }}>
          <img src={preview} alt={label} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#000', display: 'block' }} />
          <button onClick={onClear}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.75)')}
          ><X size={10} /></button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f) }}
          onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed #1a1a1a', borderRadius: 8, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
        >
          <ImageIcon size={14} color="#2a2a2a" />
          <span style={{ fontSize: 10, color: '#2a2a2a' }}>Click or drag</span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handle(f) }} />
    </div>
  )
}

// ── Inline Trade Form ─────────────────────────────────────────────────────────

interface FormProps {
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

function InlineTradeForm({ trade, date, isNew, saved, onUpdate, onDateChange, onSave, onDelete, onClose }: FormProps) {
  const [activePicker, setActivePicker] = useState<string | null>(null)
  const [htfPreview, setHtfPreview] = useState<string | null>(trade.htfImgKey?.startsWith('data:') ? trade.htfImgKey : null)
  const [execPreview, setExecPreview] = useState<string | null>(trade.execImgKey?.startsWith('data:') ? trade.execImgKey : null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => {
    const next = { ...trade, [k]: v }
    if (['symbol', 'side', 'entryPrice', 'exitPrice', 'contracts'].includes(k as string))
      next.pnl = calcTradePnl(next.symbol, next.side, next.entryPrice, next.exitPrice, next.contracts)
    onUpdate(next)
  }

  const toggleAccount = (a: AccountType) => {
    const l = trade.accounts || []
    set('accounts', l.includes(a) ? l.filter(x => x !== a) : [...l, a])
  }
  const toggleSession = (s: string) => {
    const l = trade.sessions || []
    set('sessions', l.includes(s) ? l.filter(x => x !== s) : [...l, s])
  }
  const toggleDol = (d: string) => {
    const l = trade.dol || []
    set('dol', l.includes(d) ? l.filter(x => x !== d) : [...l, d])
  }
  const toggleConf = (tag: string) => {
    set('confluences', trade.confluences.includes(tag)
      ? trade.confluences.filter(t => t !== tag)
      : [...trade.confluences, tag])
  }

  const pnlVal = parseFloat(trade.pnl)
  const hasPnl = trade.pnl !== ''
  const pnlColor = pnlVal > 0 ? '#4ade80' : pnlVal < 0 ? '#f87171' : '#888'
  const rrVal = calcRR(trade.takeProfit, trade.stopLoss)
  const rrColor = !rrVal ? '#2a2a2a' : parseFloat(rrVal) >= 1 ? '#4ade80' : '#f87171'
  const showDrawdown = trade.result === 'Win' || trade.result === 'BE' || trade.result === 'Faded'

  const pillBtn = (label: string, active: boolean, onClick: () => void, activeColor: string, activeBg: string) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      border: `1px solid ${active ? activeColor + '55' : '#1e1e1e'}`,
      background: active ? activeBg : 'transparent',
      color: active ? activeColor : '#3a3a3a',
      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
    >{label}</button>
  )

  const tagChip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      border: `1px solid ${active ? '#3a3a3a' : '#1a1a1a'}`,
      background: active ? '#1e1e1e' : 'transparent',
      color: active ? '#d0d0d0' : '#3a3a3a',
      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#2a2a2a' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = '#1a1a1a' } }}
    >{label}</button>
  )

  return (
    <div style={{ borderTop: '1px solid #111', background: '#080808', padding: '26px 36px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Top controls row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Result */}
          <div style={{ display: 'flex', gap: 5, flex: '0 0 auto' }}>
            {RESULTS.map(r => pillBtn(r.label, trade.result === r.value, () => set('result', r.value), r.color, r.bg))}
          </div>

          {/* Grade */}
          <div style={{ display: 'flex', gap: 5, flex: '0 0 auto' }}>
            {GRADES.map(g => {
              const c = GRADE_COLORS[g]
              return pillBtn(g, trade.grade === g, () => set('grade', trade.grade === g ? '' : g), c, `${c}18`)
            })}
          </div>

          <div style={{ flex: 1 }} />

          {/* Action buttons */}
          {!isNew && (
            <button
              onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '6px 10px', borderRadius: 7, border: `1px solid ${confirmDelete ? 'rgba(239,68,68,0.4)' : '#1e1e1e'}`, background: confirmDelete ? 'rgba(239,68,68,0.1)' : 'transparent', color: confirmDelete ? '#f87171' : '#444', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
              onMouseEnter={e => { if (!confirmDelete) { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' } }}
              onMouseLeave={e => { if (!confirmDelete) { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' } }}
            ><Trash2 size={11} />{confirmDelete ? 'Confirm?' : 'Delete'}</button>
          )}
          <button onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: saved ? 'rgba(74,222,128,0.12)' : '#f0f0f0', color: saved ? '#4ade80' : '#111', outline: saved ? '1px solid rgba(74,222,128,0.25)' : 'none', transition: 'all 0.2s', fontFamily: 'inherit' }}>
            <Save size={12} />{saved ? 'Saved!' : 'Save'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a2a2a', display: 'flex', padding: 4, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#666')}
            onMouseLeave={e => (e.currentTarget.style.color = '#2a2a2a')}
          ><X size={15} /></button>
        </div>

        {/* ── Row 1: Date / Time / Account / Symbol / Direction / Contracts / Setup ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 110px 1fr 110px 140px 110px 1fr', gap: 16 }}>
          <div>
            {fieldLabel('Date')}
            <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
              style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
          </div>
          <div>
            {fieldLabel('Time')}
            <input type="time" value={trade.time || ''} onChange={e => set('time', e.target.value)}
              style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
          </div>
          <div>
            {fieldLabel('Account')}
            <div style={{ display: 'flex', gap: 5, height: 36 }}>
              {ACCOUNT_OPTIONS.map(a => {
                const active = (trade.accounts || []).includes(a.value)
                return (
                  <button key={a.value} onClick={() => toggleAccount(a.value)} style={{
                    flex: 1, borderRadius: 8, fontSize: 11, fontWeight: 500,
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
          <div>
            {fieldLabel('Symbol')}
            <select value={trade.symbol} onChange={e => set('symbol', e.target.value)}
              style={{ ...inputBase, cursor: 'pointer' }} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')}>
              <option value="">—</option>
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            {fieldLabel('Direction')}
            <div style={{ display: 'flex', gap: 5, height: 36 }}>
              {(['Long', 'Short'] as const).map(side => {
                const active = trade.side === side
                const c = side === 'Long' ? '#22d3ee' : '#f87171'
                return (
                  <button key={side} onClick={() => set('side', side)} style={{
                    flex: 1, borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? c + '44' : '#1e1e1e'}`,
                    background: active ? `${c}14` : 'transparent',
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
            {fieldLabel('Contracts')}
            <input type="number" value={trade.contracts} onChange={e => set('contracts', e.target.value)}
              placeholder="1" min="0" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
          </div>
          <div>
            {fieldLabel('Setup')}
            <input value={trade.setup || ''} onChange={e => set('setup', e.target.value)}
              placeholder="5m FVG, OB retest…" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
          </div>
        </div>

        {/* ── Row 2: Entry / Exit / TP / SL / P&L / RR / Drawdown ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' + (showDrawdown ? ' 1fr' : ''), gap: 16 }}>
          {([
            { key: 'entryPrice' as const, label: 'Entry' },
            { key: 'exitPrice'  as const, label: 'Exit'  },
            { key: 'takeProfit' as const, label: 'TP (pts)' },
            { key: 'stopLoss'   as const, label: 'SL (pts)' },
          ]).map(f => (
            <div key={f.key}>
              {fieldLabel(f.label)}
              <input type="number" value={trade[f.key]} onChange={e => set(f.key, e.target.value)}
                placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
            </div>
          ))}
          {/* Calc P&L */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fieldLabel('Calc P&L')}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a', padding: '0 10px' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: hasPnl ? pnlColor : '#2a2a2a' }}>
                {hasPnl ? (pnlVal >= 0 ? '+' : '') + formatCurrency(pnlVal) : '—'}
              </span>
            </div>
          </div>
          {/* R:R */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fieldLabel('R:R')}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a', padding: '0 10px' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: rrColor }}>
                {rrVal ? `${rrVal}R` : '—'}
              </span>
            </div>
          </div>
          {/* Drawdown */}
          {showDrawdown && (
            <div>
              {fieldLabel('Drawdown (pts)')}
              <input type="number" value={trade.drawdown} onChange={e => set('drawdown', e.target.value)}
                placeholder="0" min="0" step="0.25" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
            </div>
          )}
        </div>

        {/* ── Row 3: Session + Confluences + DOL ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 28 }}>

          {/* Session */}
          <div>
            {fieldLabel('Session')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SESSION_OPTIONS.map(s => tagChip(s.label, trade.sessions.includes(s.value), () => toggleSession(s.value)))}
            </div>
          </div>

          {/* Confluences */}
          <div>
            {fieldLabel('Confluences')}
            {trade.confluences.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {trade.confluences.map(tag => (
                  <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 11, background: '#1e1e1e', border: '1px solid #333', color: '#d0d0d0' }}>
                    {tag}
                    <button onClick={() => toggleConf(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#555', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
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
                      const sel = trade.confluences.includes(combo)
                      return (
                        <button key={tf} onClick={() => toggleConf(combo)} style={{
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                          border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                          background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
                          color: sel ? '#4ade80' : '#3a3a3a',
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
                      {STDV_LEVELS.map(lv => {
                        const tag = `STDV ${lv}σ`
                        const sel = trade.confluences.includes(tag)
                        return (
                          <button key={lv} onClick={() => toggleConf(tag)} style={{
                            padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                            border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                            background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
                            color: sel ? '#4ade80' : '#3a3a3a',
                            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                          }}>{lv}σ</button>
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
            {fieldLabel('Draw on Liquidity')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {DOL_OPTIONS.map(d => tagChip(d, (trade.dol || []).includes(d), () => toggleDol(d)))}
            </div>
          </div>
        </div>

        {/* ── Row 4: Screenshots ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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

// ── Summary Row ───────────────────────────────────────────────────────────────

function SummaryRow({ trade, date, expanded, onToggle, COL }: {
  trade: TradeLog & { date: string }
  date: string
  expanded: boolean
  onToggle: () => void
  COL: string
}) {
  const pnl = parseFloat(trade.pnl) || 0
  const pnlColor = pnl > 0 ? '#4ade80' : pnl < 0 ? '#f87171' : '#555'
  const rrVal = calcRR(trade.takeProfit, trade.stopLoss)
  const rrNum = rrVal ? parseFloat(rrVal) : null
  const rrColor = rrNum === null ? '#333' : rrNum >= 1 ? '#4ade80' : '#f87171'
  const rc = RESULT_COLORS[trade.result] || '#888'
  const gc = trade.grade ? (GRADE_COLORS[trade.grade] || '#888') : null
  const dateLabel = `${date.slice(5).replace('-', '/')}${trade.time ? ' · ' + trade.time : ''}`
  const sessionLabel = trade.sessions.length > 0 ? trade.sessions.join(', ') : '—'
  const setupLabel = trade.setup || (trade.confluences[0] || '—')

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'grid', gridTemplateColumns: COL,
        padding: '10px 36px', alignItems: 'center',
        cursor: 'pointer', transition: 'background 0.1s',
        borderLeft: `2px solid ${expanded ? '#2a2a2a' : 'transparent'}`,
        background: expanded ? '#0e0e0e' : 'transparent',
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#0b0b0b' }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 11, color: expanded ? '#666' : '#444', fontWeight: 500 }}>{dateLabel}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: expanded ? '#ddd' : '#bbb' }}>{trade.symbol || '—'}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, width: 'fit-content',
        background: trade.side === 'Long' ? 'rgba(34,211,238,0.12)' : 'rgba(248,113,113,0.1)',
        border: `1px solid ${trade.side === 'Long' ? 'rgba(34,211,238,0.25)' : 'rgba(248,113,113,0.2)'}`,
        color: trade.side === 'Long' ? '#22d3ee' : '#f87171',
      }}>{trade.side}</span>
      <span style={{ fontSize: 12, color: '#3a3a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10 }}>{setupLabel}</span>
      <span style={{ fontSize: 11, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sessionLabel}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: pnlColor }}>
        {trade.pnl ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '—'}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: rrColor }}>
        {rrVal ? `${rrNum! >= 0 ? '+' : ''}${rrVal}R` : '—'}
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, width: 'fit-content',
        background: `${rc}18`, border: `1px solid ${rc}44`, color: rc,
      }}>{trade.result}</span>
      {gc ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, width: 'fit-content',
          background: `${gc}18`, border: `1px solid ${gc}44`, color: gc,
        }}>{trade.grade}</span>
      ) : (
        <span style={{ fontSize: 12, color: '#1e1e1e' }}>—</span>
      )}
      <ChevronDown size={13} color="#2a2a2a" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s', justifySelf: 'end' }} />
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

  // expandedKey: "date::id" for existing, "new" for new trade
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  // buffer holds the in-progress edits for whichever row is expanded
  const [buffer, setBuffer] = useState<TradeLog | null>(null)
  const [bufferDate, setBufferDate] = useState(todayStr())
  const [saved, setSaved] = useState(false)
  // pending new trade (not yet in entries)
  const [pendingNew, setPendingNew] = useState<TradeLog | null>(null)

  useEffect(() => {
    if (initialDate) openNew(initialDate)
  }, [initialDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flatten all existing trades
  const allTrades = entries
    .flatMap(e => e.trades.map(t => ({ ...t, date: e.date })))
    .sort((a, b) => {
      const dc = b.date.localeCompare(a.date)
      return dc !== 0 ? dc : (b.time || '').localeCompare(a.time || '')
    })

  const filtered = allTrades.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      if (!t.symbol.toLowerCase().includes(q) && !(t.setup || '').toLowerCase().includes(q) && !t.result.toLowerCase().includes(q)) return false
    }
    if (filterResult !== 'All' && t.result !== filterResult) return false
    if (filterSession !== 'All' && !t.sessions.includes(filterSession)) return false
    const pnl = parseFloat(t.pnl) || 0
    if (filterPnl === 'Profitable' && pnl <= 0) return false
    if (filterPnl === 'Unprofitable' && pnl >= 0) return false
    return true
  })

  function openNew(date?: string) {
    const t = emptyTrade()
    setPendingNew(t)
    setBuffer(t)
    setBufferDate(date || todayStr())
    setExpandedKey('new')
    setSaved(false)
  }

  function openEdit(t: TradeLog & { date: string }) {
    const key = `${t.date}::${t.id}`
    if (expandedKey === key) {
      setExpandedKey(null); setBuffer(null)
    } else {
      setExpandedKey(key)
      setBuffer({ ...t })
      setBufferDate(t.date)
      setSaved(false)
    }
    setPendingNew(null)
  }

  function closeExpanded() {
    setExpandedKey(null); setBuffer(null); setPendingNew(null)
  }

  function handleSave() {
    if (!buffer) return
    const existingEntry = entries.find(e => e.date === bufferDate)
    const entry = safeEntry(existingEntry, bufferDate)
    const exists = entry.trades.some(t => t.id === buffer.id)
    entry.trades = exists
      ? entry.trades.map(t => t.id === buffer.id ? buffer : t)
      : [...entry.trades, buffer]
    entry.updatedAt = new Date().toISOString()
    onSave(entry)
    setSaved(true)
    setPendingNew(null)
    setTimeout(() => {
      setSaved(false)
      setExpandedKey(null)
      setBuffer(null)
    }, 900)
  }

  function handleDelete() {
    if (!buffer) return
    const existingEntry = entries.find(e => e.date === bufferDate)
    if (!existingEntry) return
    const entry = safeEntry(existingEntry, bufferDate)
    entry.trades = entry.trades.filter(t => t.id !== buffer.id)
    entry.updatedAt = new Date().toISOString()
    if (entry.trades.length === 0) onDelete(bufferDate)
    else onSave(entry)
    setExpandedKey(null); setBuffer(null); setPendingNew(null)
  }

  const filtersActive = search || filterResult !== 'All' || filterSession !== 'All' || filterPnl !== 'All'
  const COL = '150px 70px 84px 1fr 130px 110px 70px 76px 56px 24px'

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* Filter bar */}
      <div style={{ flexShrink: 0, padding: '12px 36px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 10, background: '#070707' }}>
        <span style={{ fontSize: 12, color: '#252525', marginRight: 4, whiteSpace: 'nowrap' }}>Log, scan and review every trade.</span>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#2a2a2a', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trades…"
            style={{ ...inputBase, paddingLeft: 30, fontSize: 13, padding: '7px 12px 7px 30px', borderRadius: 8, background: '#0a0a0a', border: '1px solid #161616' }}
            onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#161616')} />
        </div>
        <button onClick={() => openNew()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#f0f0f0', color: '#111', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f0f0f0')}
        ><Plus size={13} /> New Trade</button>
        {[
          { label: 'Result',  value: filterResult,  opts: ['All', 'Win', 'Loss', 'BE', 'Faded'],                                   set: setFilterResult  },
          { label: 'Session', value: filterSession, opts: ['All', 'Asia', 'London', 'NY', 'London Open', 'NY Open'],               set: setFilterSession },
          { label: 'P&L',    value: filterPnl,     opts: ['All', 'Profitable', 'Unprofitable'],                                    set: setFilterPnl     },
        ].map(f => (
          <div key={f.label} style={{ position: 'relative' }}>
            <select value={f.value} onChange={e => f.set(e.target.value)} style={selectStyle(f.value !== 'All')}>
              {f.opts.map(o => <option key={o} value={o}>{f.label}: {o}</option>)}
            </select>
            <ChevronDown size={10} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none' }} />
          </div>
        ))}
        {filtersActive && (
          <button onClick={() => { setSearch(''); setFilterResult('All'); setFilterSession('All'); setFilterPnl('All') }}
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #1e1e1e', borderRadius: 8, color: '#444', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = '#333' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' }}
          >Clear</button>
        )}
      </div>

      {/* Column headers */}
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: COL, padding: '0 36px', background: '#060606', borderBottom: '1px solid #0e0e0e' }}>
        {['Date', 'Pair', 'Direction', 'Setup', 'Session', 'Net P&L', 'R', 'Result', 'Grade', ''].map(h => (
          <div key={h} style={hStyle}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Pending new trade row — always at top when active */}
        {pendingNew && buffer && expandedKey === 'new' && (
          <div style={{ borderBottom: '1px solid #111' }}>
            <div style={{ display: 'grid', gridTemplateColumns: COL, padding: '10px 36px', alignItems: 'center', background: '#0e0e0e', borderLeft: '2px solid #2a2a2a' }}>
              <span style={{ fontSize: 11, color: '#555', fontWeight: 500, gridColumn: '1 / 4' }}>New trade</span>
              <span style={{ fontSize: 11, color: '#2a2a2a', gridColumn: '4 / -1', textAlign: 'right' }}>Fill in details below</span>
            </div>
            <InlineTradeForm
              trade={buffer}
              date={bufferDate}
              isNew={true}
              saved={saved}
              onUpdate={t => setBuffer(t)}
              onDateChange={d => setBufferDate(d)}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={closeExpanded}
            />
          </div>
        )}

        {filtered.length === 0 && !pendingNew ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 0', gap: 12 }}>
            <BookOpen size={30} color="#1a1a1a" />
            <p style={{ color: '#1e1e1e', fontSize: 13, margin: 0 }}>
              {allTrades.length === 0 ? 'No trades yet — click New Trade to add one' : 'No trades match your filters'}
            </p>
          </div>
        ) : (
          filtered.map((t, idx) => {
            const key = `${t.date}::${t.id}`
            const isExpanded = expandedKey === key
            const rowBg = idx % 2 === 0 ? '#080808' : '#070707'

            return (
              <div key={key} style={{ borderBottom: `1px solid ${isExpanded ? '#161616' : '#0c0c0c'}`, background: isExpanded ? '#0e0e0e' : rowBg }}>
                <SummaryRow
                  trade={t}
                  date={t.date}
                  expanded={isExpanded}
                  onToggle={() => openEdit(t)}
                  COL={COL}
                />
                {/* Collapsible form */}
                <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
                  <div style={{ overflow: 'hidden' }}>
                    {isExpanded && buffer && (
                      <InlineTradeForm
                        trade={buffer}
                        date={bufferDate}
                        isNew={false}
                        saved={saved}
                        onUpdate={t => setBuffer(t)}
                        onDateChange={d => setBufferDate(d)}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        onClose={closeExpanded}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
