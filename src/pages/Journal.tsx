import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Save, Plus, Trash2, BookOpen,
  ImageIcon, X, AlertTriangle, ArrowLeft, NotebookPen, Trash,
} from 'lucide-react'
import type { JournalEntry, TradeLog, TradeResult, Emotion, AccountType, SessionType, TradingRule } from '../types'
import { formatCurrency } from '../utils/stats'

// ── Utilities ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shiftDate(s: string, days: number): string {
  const d = new Date(s + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
function formatShort(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function emptyEntry(date: string): JournalEntry {
  return {
    id: uid(), date,
    premktImgKey: undefined,
    premktAnalysis: '',
    redFolderNews: false,
    redFolderNewsText: '',
    trades: [],
    emotion: undefined,
    postMarketNotes: '',
    rulesFollowed: [],
    updatedAt: '',
  }
}
function emptyTrade(): TradeLog {
  return {
    id: uid(),
    result: 'Win',
    accounts: [],
    symbol: '',
    side: 'Long',
    contracts: '',
    entryPrice: '',
    exitPrice: '',
    takeProfit: '',
    stopLoss: '',
    pnl: '',
    drawdown: '',
    confluences: [],
    sessions: [],
    dol: [],
    htfImgKey: undefined,
    execImgKey: undefined,
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
    emotion: (r.emotion as Emotion | undefined) ?? undefined,
    premktImgKey: typeof r.premktImgKey === 'string' ? r.premktImgKey : undefined,
    redFolderNews: typeof r.redFolderNews === 'boolean' ? r.redFolderNews : false,
    redFolderNewsText: typeof r.redFolderNewsText === 'string' ? r.redFolderNewsText : '',
    rulesFollowed: Array.isArray(r.rulesFollowed) ? (r.rulesFollowed as string[]) : [],
    trades: Array.isArray(r.trades) ? (r.trades as TradeLog[]).map(t => ({ ...emptyTrade(), ...t })) : [],
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
  }
}

// ── Auto P&L ──────────────────────────────────────────────────────────────────

const POINT_VALUES: Record<string, number> = {
  NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10,
}

function calcTradePnl(symbol: string, side: 'Long' | 'Short', entry: string, exit: string, contracts: string): string {
  const pv = POINT_VALUES[symbol]
  const e = parseFloat(entry)
  const x = parseFloat(exit)
  const c = parseFloat(contracts)
  if (!pv || isNaN(e) || isNaN(x) || isNaN(c) || c <= 0 || e === 0 || x === 0) return ''
  const points = side === 'Long' ? (x - e) : (e - x)
  return (points * pv * c).toFixed(2)
}

function calcTradeRR(entry: string, tp: string, sl: string): string {
  const e = parseFloat(entry), t = parseFloat(tp), s = parseFloat(sl)
  if (isNaN(e) || isNaN(t) || isNaN(s) || e === 0 || t === 0 || s === 0) return ''
  const reward = Math.abs(t - e)
  const risk = Math.abs(s - e)
  if (risk === 0) return ''
  return (reward / risk).toFixed(2)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = ['NQ', 'ES', 'GC', 'MNQ', 'MES', 'MGC']

const CONFLUENCE_BASES = [
  'Rejection Block', 'Order Block', 'FVG', 'iFVG', 'CISD', 'BPR', 'STDV', 'OTE',
]
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1hr', '4hr', 'Daily']

const RESULTS: { value: TradeResult; label: string; color: string; activeBg: string }[] = [
  { value: 'Win',   label: 'Win',   color: '#4ade80', activeBg: 'rgba(74,222,128,0.12)'  },
  { value: 'Loss',  label: 'Loss',  color: '#f87171', activeBg: 'rgba(248,113,113,0.12)' },
  { value: 'BE',    label: 'BE',    color: '#aaaaaa', activeBg: 'rgba(170,170,170,0.1)'  },
  { value: 'Faded', label: 'Faded', color: '#fb923c', activeBg: 'rgba(251,146,60,0.1)'   },
]

const EMOTIONS: { value: Emotion; emoji: string; label: string }[] = [
  { value: 'very_happy',  emoji: '😄', label: 'Very Happy'  },
  { value: 'happy',       emoji: '🙂', label: 'Satisfied'   },
  { value: 'neutral',     emoji: '😐', label: 'Neutral'     },
  { value: 'frustrated',  emoji: '😕', label: 'Frustrated'  },
  { value: 'angry',       emoji: '😤', label: 'Disappointed' },
  { value: 'very_angry',  emoji: '😡', label: 'Very Angry'  },
]

const ACCOUNT_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'Live',   label: 'Live Account'   },
  { value: 'Funded', label: 'Funded Account' },
  { value: 'Eval',   label: 'Eval Account'   },
]

const SESSION_OPTIONS: { value: SessionType; label: string }[] = [
  { value: 'Asia',   label: 'Asia Session'     },
  { value: 'London', label: 'London Session'   },
  { value: 'NY',     label: 'New York Session' },
]

const DOL_OPTIONS = [
  'Asia High', 'Asia Low', 'London High', 'London Low',
  'Equal Highs', 'Equal Lows', 'HTF PD Array',
  'Previous Day High', 'Previous Day Low',
  'Weekly High', 'Weekly Low', 'Daily Open',
]

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 10,
  padding: '9px 12px', fontSize: 13, color: '#e0e0e0', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, color: '#444', marginBottom: 6,
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function CollapsibleSection({
  title, badge, action, defaultOpen = true, children,
}: {
  title: string; badge?: string; action?: React.ReactNode
  defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderRadius: 16, border: '1px solid #1a1a1a', overflow: 'hidden', background: '#0f0f0f' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 18px', minHeight: 50, borderBottom: open ? '1px solid #181818' : '1px solid transparent', transition: 'border-color 0.25s ease' }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', textAlign: 'left' }}
        >
          <ChevronDown size={14} strokeWidth={2} style={{ color: '#444', flexShrink: 0, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: open ? '#777' : '#444', transition: 'color 0.2s' }}>
            {title}
          </span>
          {badge && <span style={{ fontSize: 11, color: '#333', fontWeight: 400 }}>{badge}</span>}
        </button>
        <div style={{ opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(6px)', transition: 'opacity 0.2s ease, transform 0.2s ease', pointerEvents: open ? 'auto' : 'none' }}>
          {action}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 24px', background: '#0a0a0a' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Screenshot Upload ─────────────────────────────────────────────────────────

function ScreenshotUpload({ label, preview, onFile, onClear }: { label: string; preview: string | null; onFile: (url: string) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => { if (typeof e.target?.result === 'string') onFile(e.target.result) }
    reader.readAsDataURL(file)
  }
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #222' }}>
          <img src={preview} alt={label} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', background: '#000', display: 'block' }} />
          <button onClick={onClear} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.75)')}
          ><X size={12} /></button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed #1e1e1e', borderRadius: 10, padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e1e')}
        >
          <ImageIcon size={18} color="#2a2a2a" />
          <span style={{ fontSize: 11, color: '#333' }}>Click or drag screenshot</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Tag Chip ──────────────────────────────────────────────────────────────────

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      border: `1px solid ${active ? '#3a3a3a' : '#1a1a1a'}`,
      background: active ? '#1e1e1e' : 'transparent',
      color: active ? '#d0d0d0' : '#3a3a3a',
      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#2a2a2a' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = '#1a1a1a' } }}
    >
      {label}
    </button>
  )
}

// ── Trade Card ────────────────────────────────────────────────────────────────

function TradeCard({ trade, onUpdate, onRemove }: {
  trade: TradeLog
  onUpdate: (t: TradeLog) => void; onRemove: () => void
}) {
  const [activePicker, setActivePicker] = useState<string | null>(null)
  const [htfPreview, setHtfPreview] = useState<string | null>(trade.htfImgKey?.startsWith('data:') ? trade.htfImgKey : null)
  const [execPreview, setExecPreview] = useState<string | null>(trade.execImgKey?.startsWith('data:') ? trade.execImgKey : null)

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
  const toggleSession = (s: SessionType) => {
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

  const showDrawdown = trade.result === 'Win' || trade.result === 'BE' || trade.result === 'Faded'
  const pnlVal = parseFloat(trade.pnl)
  const pnlColor = pnlVal > 0 ? '#4ade80' : pnlVal < 0 ? '#f87171' : '#888'
  const hasPnl = trade.pnl !== ''

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: 10, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{text}</div>
  )

  return (
    <div style={{ borderRadius: 14, border: '1px solid #1a1a1a', background: '#0d0d0d', padding: '18px', display: 'flex', flexDirection: 'column', gap: 18 }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#222')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
    >

      {/* Result + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {RESULTS.map(r => {
            const active = trade.result === r.value
            return (
              <button key={r.value} onClick={() => set('result', r.value)} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
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
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#2a2a2a', cursor: 'pointer', padding: 4, display: 'flex', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#2a2a2a')}
        ><Trash2 size={14} /></button>
      </div>

      {/* Account type */}
      <div>
        {sectionLabel('Account')}
        <div style={{ display: 'flex', gap: 6 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Symbol</label>
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
          <label style={labelStyle}>Direction</label>
          <div style={{ display: 'flex', gap: 6, height: 38 }}>
            {(['Long', 'Short'] as const).map(side => {
              const active = trade.side === side
              const c = side === 'Long' ? '#4ade80' : '#f87171'
              const bg = side === 'Long' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)'
              return (
                <button key={side} onClick={() => set('side', side)} style={{
                  flex: 1, borderRadius: 10, fontSize: 12, fontWeight: 600,
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
          <label style={labelStyle}>Contracts</label>
          <input type="number" value={trade.contracts} onChange={e => set('contracts', e.target.value)}
            placeholder="1" min="0" step="1"
            style={inputBase}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          />
        </div>
      </div>

      {/* Entry / Exit / TP / SL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {([
          { key: 'entryPrice' as const, label: 'Entry Price' },
          { key: 'exitPrice'  as const, label: 'Exit Price'  },
          { key: 'takeProfit' as const, label: 'Take Profit' },
          { key: 'stopLoss'   as const, label: 'Stop Loss'   },
        ]).map(f => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            <input type="number" value={trade[f.key]} onChange={e => set(f.key, e.target.value)}
              placeholder="0.00" style={inputBase}
              onFocus={e => (e.target.style.borderColor = '#333')}
              onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
            />
          </div>
        ))}
      </div>

      {/* Auto-calculated P&L + R:R */}
      {(() => {
        const rrVal = calcTradeRR(trade.entryPrice, trade.takeProfit, trade.stopLoss)
        const rrColor = (() => {
          if (!rrVal) return '#2a2a2a'
          const e = parseFloat(trade.entryPrice), tp = parseFloat(trade.takeProfit), sl = parseFloat(trade.stopLoss)
          if (isNaN(e) || isNaN(tp) || isNaN(sl) || e === 0 || tp === 0 || sl === 0) return '#e0e0e0'
          const positive = trade.side === 'Long' ? (tp > e && e > sl) : (tp < e && e < sl)
          return positive ? '#4ade80' : '#f87171'
        })()
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#111', borderRadius: 10, border: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Calculated P&L</span>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: hasPnl ? pnlColor : '#2a2a2a' }}>
                {hasPnl ? (pnlVal >= 0 ? '+' : '') + formatCurrency(pnlVal) : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#111', borderRadius: 10, border: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>R:R</span>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: rrColor }}>
                {rrVal ? `${rrVal}R` : '—'}
              </span>
            </div>
          </div>
        )
      })()}

      {/* Drawdown — Win / BE / Faded only */}
      {showDrawdown && (
        <div>
          <label style={labelStyle}>Drawdown (points before play out)</label>
          <input type="number" value={trade.drawdown} onChange={e => set('drawdown', e.target.value)}
            placeholder="0.00" min="0" step="0.25"
            style={inputBase}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          />
        </div>
      )}

      {/* Confluences */}
      <div>
        {sectionLabel('Confluences')}
        {trade.confluences.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {trade.confluences.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 12px', borderRadius: 999, fontSize: 11, background: '#1e1e1e', border: '1px solid #333', color: '#d0d0d0' }}>
                {tag}
                <button onClick={() => toggleConfluence(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#555', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                ><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: activePicker ? 10 : 0 }}>
          {CONFLUENCE_BASES.map(base => {
            const hasAny = trade.confluences.some(c => c.startsWith(`${base} (`))
            const isOpen = activePicker === base
            return (
              <button key={base} onClick={() => setActivePicker(isOpen ? null : base)} style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
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
          <div style={{ padding: '10px 14px', background: '#111', borderRadius: 10, border: '1px solid #1a1a1a' }}>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              {activePicker} — Timeframe
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TIMEFRAMES.map(tf => {
                const combo = `${activePicker} (${tf})`
                const selected = trade.confluences.includes(combo)
                return (
                  <button key={tf} onClick={() => toggleConfluence(combo)} style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                    border: `1px solid ${selected ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                    background: selected ? 'rgba(74,222,128,0.1)' : 'transparent',
                    color: selected ? '#4ade80' : '#3a3a3a',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                    onMouseEnter={e => { if (!selected) { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#2a2a2a' } }}
                    onMouseLeave={e => { if (!selected) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = '#1a1a1a' } }}
                  >{tf}</button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Session */}
      <div>
        {sectionLabel('Session')}
        <div style={{ display: 'flex', gap: 6 }}>
          {SESSION_OPTIONS.map(s => (
            <TagChip key={s.value} label={s.label} active={(trade.sessions || []).includes(s.value)} onClick={() => toggleSession(s.value)} />
          ))}
        </div>
      </div>

      {/* DOL */}
      <div>
        {sectionLabel('Draw on Liquidity (DOL)')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DOL_OPTIONS.map(d => (
            <TagChip key={d} label={d} active={(trade.dol || []).includes(d)} onClick={() => toggleDol(d)} />
          ))}
        </div>
      </div>

      {/* Screenshots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ScreenshotUpload
          label="HTF Chart"
          preview={htfPreview}
          onFile={url => { setHtfPreview(url); set('htfImgKey', url) }}
          onClear={() => { setHtfPreview(null); set('htfImgKey', undefined) }}
        />
        <ScreenshotUpload
          label="Execution Chart"
          preview={execPreview}
          onFile={url => { setExecPreview(url); set('execImgKey', url) }}
          onClear={() => { setExecPreview(null); set('execImgKey', undefined) }}
        />
      </div>
    </div>
  )
}

// ── Rules Followed ────────────────────────────────────────────────────────────

function RulesSection({ rules, followed, onChange, onAddRule, onRemoveRule }: {
  rules: TradingRule[]
  followed: string[]
  onChange: (ids: string[]) => void
  onAddRule: (text: string) => void
  onRemoveRule: (id: string) => void
}) {
  const [newRule, setNewRule] = useState('')

  const toggle = (id: string) => {
    onChange(followed.includes(id) ? followed.filter(x => x !== id) : [...followed, id])
  }
  const add = () => {
    const t = newRule.trim(); if (!t) return
    onAddRule(t)
    setNewRule('')
  }

  const pct = rules.length === 0 ? 0 : Math.round((followed.filter(id => rules.some(r => r.id === id)).length / rules.length) * 100)
  const barColor = pct <= 33 ? '#f87171' : pct <= 66 ? '#fbbf24' : '#4ade80'

  return (
    <div>
      {/* Progress */}
      {rules.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rules Followed</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: barColor, transition: 'width 0.4s ease, background 0.4s ease' }} />
          </div>
        </div>
      )}

      {/* Rule list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {rules.length === 0 && (
          <p style={{ fontSize: 12, color: '#2a2a2a', margin: 0 }}>No rules yet — add your trading rules below</p>
        )}
        {rules.map(rule => {
          const checked = followed.includes(rule.id)
          return (
            <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: checked ? 'rgba(255,255,255,0.03)' : 'transparent', border: `1px solid ${checked ? '#1e1e1e' : 'transparent'}`, transition: 'all 0.15s' }}>
              <button onClick={() => toggle(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0, color: checked ? '#4ade80' : '#2a2a2a', transition: 'color 0.15s' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  {checked ? (
                    <>
                      <rect width="16" height="16" rx="4" fill="rgba(74,222,128,0.15)" stroke="#4ade80" strokeWidth="1.5" />
                      <path d="M4 8l3 3 5-5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  ) : (
                    <rect width="16" height="16" rx="4" fill="transparent" stroke="#2a2a2a" strokeWidth="1.5" />
                  )}
                </svg>
              </button>
              <span style={{ flex: 1, fontSize: 13, color: checked ? '#d0d0d0' : '#555', transition: 'color 0.15s' }}>{rule.text}</span>
              <button onClick={() => onRemoveRule(rule.id)} style={{ background: 'none', border: 'none', color: '#222', cursor: 'pointer', padding: 0, display: 'flex', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = '#222')}
              ><Trash2 size={12} /></button>
            </div>
          )
        })}
      </div>

      {/* Add rule */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newRule} onChange={e => setNewRule(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a trading rule…"
          style={{ flex: 1, ...inputBase }}
          onFocus={e => (e.target.style.borderColor = '#333')}
          onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
        />
        <button onClick={add} style={{ background: '#131313', border: '1px solid #1e1e1e', color: '#444', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', display: 'flex', transition: 'all 0.15s', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#ccc' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#131313'; e.currentTarget.style.color = '#444' }}
        ><Plus size={14} /></button>
      </div>
    </div>
  )
}

// ── Journal List (landing) ────────────────────────────────────────────────────

function JournalList({ entries, onOpen, onNew, onDelete }: {
  entries: JournalEntry[]
  onOpen: (date: string) => void
  onNew: () => void
  onDelete: (date: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  const getDayPnl = (entry: JournalEntry) =>
    entry.trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0)

  const handleDelete = (date: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete === date) {
      onDelete(date)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(date)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }} onClick={() => setConfirmDelete(null)}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', margin: 0, letterSpacing: '-0.02em' }}>Trading Journal</h1>
          <p style={{ fontSize: 13, color: '#3a3a3a', margin: '6px 0 0' }}>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button onClick={onNew} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
          background: '#f0f0f0', color: '#111', borderRadius: 10, border: 'none',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#ffffff')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f0f0f0')}
        >
          <NotebookPen size={14} /> New Entry
        </button>
      </div>

      {sorted.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 16 }}>
          <BookOpen size={36} color="#1a1a1a" />
          <p style={{ color: '#2a2a2a', fontSize: 14, margin: 0 }}>No journal entries yet</p>
          <button onClick={onNew} style={{ fontSize: 13, color: '#555', background: 'none', border: '1px solid #222', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e0e0e0'; e.currentTarget.style.borderColor = '#3a3a3a' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222' }}
          >Start your first entry</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {sorted.map(entry => {
            const tradeCount = entry.trades.length
            const pnl = getDayPnl(entry)
            const pnlColor = tradeCount === 0 ? '#333' : pnl > 0 ? '#4ade80' : pnl < 0 ? '#f87171' : '#888'
            const em = EMOTIONS.find(x => x.value === entry.emotion)
            const d = new Date(entry.date + 'T12:00:00')
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
            const dateFmt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

            return (
              <div key={entry.date} style={{ position: 'relative' }}>
              <button onClick={() => onOpen(entry.date)} style={{
                width: '100%', textAlign: 'left', background: '#111', border: `1px solid ${confirmDelete === entry.date ? '#3a1a1a' : '#1a1a1a'}`, borderRadius: 14,
                padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'inherit',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = confirmDelete === entry.date ? '#3a1a1a' : '#2a2a2a'; e.currentTarget.style.background = '#141414' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = confirmDelete === entry.date ? '#3a1a1a' : '#1a1a1a'; e.currentTarget.style.background = '#111' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{dayName}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0' }}>{dateFmt}</div>
                  </div>
                  {em && <span style={{ fontSize: 20 }}>{em.emoji}</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#444' }}>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
                  {tradeCount > 0 && (
                    <span style={{ fontSize: 15, fontWeight: 700, color: pnlColor }}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                  )}
                </div>

                {entry.premktAnalysis && (
                  <p style={{ fontSize: 11, color: '#333', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {entry.premktAnalysis}
                  </p>
                )}

                {entry.redFolderNews && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle size={10} color="#fbbf24" />
                    <span style={{ fontSize: 10, color: '#666' }}>Red folder news</span>
                  </div>
                )}
              </button>
              {/* Delete button */}
              <button
                onClick={e => handleDelete(entry.date, e)}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: confirmDelete === entry.date ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.6)',
                  border: `1px solid ${confirmDelete === entry.date ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                  borderRadius: 8, padding: confirmDelete === entry.date ? '4px 10px' : '5px 6px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  color: confirmDelete === entry.date ? '#f87171' : '#444',
                  fontSize: 11, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (confirmDelete !== entry.date) { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#f87171' } }}
                onMouseLeave={e => { if (confirmDelete !== entry.date) { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = '#444' } }}
              >
                <Trash size={11} />
                {confirmDelete === entry.date && 'Delete?'}
              </button>
              </div>
            )
          })}
        </div>
      )}
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

export function Journal({ entries, tradingRules, onSave, onDelete, onAddTradingRule, onRemoveTradingRule, initialDate }: JournalProps) {
  const TODAY = todayStr()
  const [view, setView] = useState<'list' | 'entry'>(initialDate ? 'entry' : 'list')
  const [date, setDate] = useState(initialDate || TODAY)
  const [form, setForm] = useState<JournalEntry>(() => safeEntry(entries.find(e => e.date === (initialDate || TODAY)), initialDate || TODAY))
  const [chartPreview, setChartPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(false)

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate)
      setView('entry')
    }
  }, [initialDate])

  useEffect(() => {
    const found = entries.find(e => e.date === date)
    const entry = safeEntry(found, date)
    setForm(entry)
    setChartPreview(entry.premktImgKey?.startsWith('data:') ? entry.premktImgKey : null)
    setSaved(false)
    setConfirmDeleteEntry(false)
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = <K extends keyof JournalEntry>(k: K, v: JournalEntry[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const save = () => {
    onSave({ ...form, updatedAt: new Date().toISOString() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const openEntry = (d: string) => { setDate(d); setView('entry'); setConfirmDeleteEntry(false) }
  const newEntry = () => { setDate(TODAY); setView('entry'); setConfirmDeleteEntry(false) }

  const handleDeleteEntry = () => {
    if (!confirmDeleteEntry) { setConfirmDeleteEntry(true); return }
    onDelete(date)
    setView('list')
    setConfirmDeleteEntry(false)
  }

  const prev = () => setDate(d => shiftDate(d, -1))
  const next = () => { const n = shiftDate(date, 1); if (n <= TODAY) setDate(n) }

  const addTrade = () => patch('trades', [...form.trades, emptyTrade()])
  const updateTrade = (i: number, t: TradeLog) => patch('trades', form.trades.map((x, idx) => idx === i ? t : x))
  const removeTrade = (i: number) => patch('trades', form.trades.filter((_, idx) => idx !== i))

  const tradeCount = form.trades.length

  const textareaBase: React.CSSProperties = {
    width: '100%', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 12,
    padding: '14px 16px', fontSize: 14, color: '#e0e0e0', resize: 'none',
    outline: 'none', lineHeight: 1.7, boxSizing: 'border-box', transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  }

  const navBtnBase: React.CSSProperties = {
    padding: '6px 7px', borderRadius: 8, background: '#111', border: '1px solid #1e1e1e',
    color: '#444', cursor: 'pointer', display: 'flex', transition: 'all 0.15s', fontFamily: 'inherit',
  }

  const saveBtn = (
    <button onClick={save} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px',
      borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      background: saved ? 'rgba(74,222,128,0.12)' : '#f0f0f0',
      color: saved ? '#4ade80' : '#111',
      outline: saved ? '1px solid rgba(74,222,128,0.25)' : 'none',
      transition: 'all 0.2s ease', fontFamily: 'inherit',
    }}>
      <Save size={13} strokeWidth={2} />
      {saved ? 'Saved!' : 'Save Day'}
    </button>
  )

  // List view
  if (view === 'list') {
    return (
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <JournalList entries={entries} onOpen={openEntry} onNew={newEntry} onDelete={onDelete} />
      </div>
    )
  }

  // Entry editor
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* Date sidebar */}
      <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#060606', borderRight: '1px solid #141414', overflow: 'hidden' }}>
        <div style={{ padding: '13px 14px 11px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 7 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#333', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#888')}
            onMouseLeave={e => (e.currentTarget.style.color = '#333')}
          ><ArrowLeft size={13} /></button>
          <BookOpen size={12} color="#333" strokeWidth={1.8} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Entries</span>
        </div>
        <button onClick={() => openEntry(TODAY)} style={{
          textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid #0e0e0e',
          background: date === TODAY ? 'rgba(255,255,255,0.04)' : 'transparent',
          color: date === TODAY ? '#e0e0e0' : '#3a3a3a',
          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
        }}
          onMouseEnter={e => { if (date !== TODAY) e.currentTarget.style.color = '#777' }}
          onMouseLeave={e => { if (date !== TODAY) e.currentTarget.style.color = '#3a3a3a' }}
        >Today</button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map(e => {
            const em = EMOTIONS.find(x => x.value === e.emotion)
            const isActive = date === e.date
            const count = e.trades.length
            return (
              <button key={e.date} onClick={() => openEntry(e.date)} style={{
                width: '100%', textAlign: 'left', padding: '9px 14px',
                borderBottom: '1px solid #0c0c0c',
                background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: 'none', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'background 0.12s',
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? '#e0e0e0' : '#555' }}>{formatShort(e.date)}</div>
                  <div style={{ fontSize: 10, color: '#2a2a2a', marginTop: 2 }}>{count} trade{count !== 1 ? 's' : ''}</div>
                </div>
                {em && <span style={{ fontSize: 14 }}>{em.emoji}</span>}
              </button>
            )
          })}
          {entries.length === 0 && (
            <p style={{ fontSize: 11, color: '#1e1e1e', textAlign: 'center', padding: '20px 12px', margin: 0 }}>No entries yet</p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 54, background: '#070707', borderBottom: '1px solid #141414' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={prev} style={navBtnBase}
              onMouseEnter={e => { e.currentTarget.style.color = '#e0e0e0'; e.currentTarget.style.borderColor = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' }}
            ><ChevronLeft size={14} strokeWidth={1.8} /></button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', lineHeight: 1.2 }}>{formatDate(date)}</div>
              {date === TODAY && <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>Today</div>}
            </div>
            <button onClick={next} disabled={date >= TODAY} style={{ ...navBtnBase, opacity: date >= TODAY ? 0.25 : 1, cursor: date >= TODAY ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (date < TODAY) { e.currentTarget.style.color = '#e0e0e0'; e.currentTarget.style.borderColor = '#333' } }}
              onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' }}
            ><ChevronRight size={14} strokeWidth={1.8} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {entries.some(e => e.date === date) && (
              <button
                onClick={handleDeleteEntry}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  borderRadius: 10, border: `1px solid ${confirmDeleteEntry ? 'rgba(239,68,68,0.4)' : '#1e1e1e'}`,
                  background: confirmDeleteEntry ? 'rgba(239,68,68,0.12)' : 'transparent',
                  color: confirmDeleteEntry ? '#f87171' : '#444',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!confirmDeleteEntry) { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' } }}
                onMouseLeave={e => { if (!confirmDeleteEntry) { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' } }}
              >
                <Trash size={12} />
                {confirmDeleteEntry ? 'Confirm delete?' : 'Delete entry'}
              </button>
            )}
            {saveBtn}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Premarket Analysis */}
            <CollapsibleSection title="Premarket Analysis">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Chart upload */}
                <ScreenshotUpload
                  label="Premarket Chart"
                  preview={chartPreview}
                  onFile={url => { setChartPreview(url); patch('premktImgKey', url) }}
                  onClear={() => { setChartPreview(null); patch('premktImgKey', undefined) }}
                />

                {/* Red folder news */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: form.redFolderNews ? 10 : 0 }}>
                    <button onClick={() => patch('redFolderNews', !form.redFolderNews)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: form.redFolderNews ? 'rgba(251,191,36,0.1)' : 'transparent',
                      border: `1px solid ${form.redFolderNews ? 'rgba(251,191,36,0.35)' : '#222'}`,
                      borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      color: form.redFolderNews ? '#fbbf24' : '#444', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!form.redFolderNews) { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#333' } }}
                      onMouseLeave={e => { if (!form.redFolderNews) { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#222' } }}
                    >
                      <AlertTriangle size={13} />
                      Red Folder News
                    </button>
                  </div>
                  {form.redFolderNews && (
                    <textarea
                      value={form.redFolderNewsText}
                      onChange={e => patch('redFolderNewsText', e.target.value)}
                      rows={3}
                      placeholder="What red folder news events are scheduled today? (CPI, FOMC, NFP…)"
                      style={textareaBase}
                      onFocus={e => (e.target.style.borderColor = '#2a2a2a')}
                      onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                    />
                  )}
                </div>

                {/* Daily analysis */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Daily Analysis</label>
                  <textarea
                    value={form.premktAnalysis}
                    onChange={e => patch('premktAnalysis', e.target.value)}
                    rows={5}
                    placeholder="Key levels, bias, market structure, what you're watching today…"
                    style={textareaBase}
                    onFocus={e => (e.target.style.borderColor = '#2a2a2a')}
                    onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Trade Journal */}
            <CollapsibleSection
              title="Trade Journal"
              badge={tradeCount > 0 ? `· ${tradeCount} trade${tradeCount !== 1 ? 's' : ''}` : undefined}
              action={
                <button onClick={addTrade} style={{
                  display: 'flex', alignItems: 'center', gap: 5, background: '#141414',
                  color: '#bbb', border: '1px solid #222', borderRadius: 8,
                  padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#f0f0f0' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#bbb' }}
                ><Plus size={12} strokeWidth={2.5} /> Add Trade</button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.trades.length === 0 ? (
                  <div style={{ border: '2px dashed #151515', borderRadius: 12, padding: '32px 16px', textAlign: 'center', cursor: 'pointer' }}
                    onClick={addTrade}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#222')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#151515')}
                  >
                    <p style={{ color: '#2a2a2a', fontSize: 13, margin: 0 }}>No trades logged — click to add one</p>
                  </div>
                ) : (
                  form.trades.map((trade, i) => (
                    <TradeCard
                      key={trade.id}
                      trade={trade}
                      onUpdate={t => updateTrade(i, t)}
                      onRemove={() => removeTrade(i)}
                    />
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* Post Market Review */}
            <CollapsibleSection title="Post Market Review">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Emotion */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>How are you feeling?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                    {EMOTIONS.map(em => {
                      const active = form.emotion === em.value
                      return (
                        <button key={em.value} onClick={() => patch('emotion', active ? undefined : em.value)} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                          fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
                          border: `1px solid ${active ? '#333' : '#161616'}`,
                          background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                          color: active ? '#e0e0e0' : '#333',
                          textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'inherit',
                        }}
                          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#666' } }}
                          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#333' } }}
                        >
                          <span style={{ fontSize: 24, lineHeight: 1 }}>{em.emoji}</span>
                          {em.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Rules followed */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rules Followed</label>
                  <RulesSection
                    rules={tradingRules}
                    followed={form.rulesFollowed || []}
                    onChange={ids => patch('rulesFollowed', ids)}
                    onAddRule={onAddTradingRule}
                    onRemoveRule={onRemoveTradingRule}
                  />
                </div>

                {/* Post market notes */}
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Post Market Notes</label>
                  <textarea
                    value={form.postMarketNotes}
                    onChange={e => patch('postMarketNotes', e.target.value)}
                    rows={5}
                    placeholder="What went well? What to improve? Key lessons from today…"
                    style={textareaBase}
                    onFocus={e => (e.target.style.borderColor = '#2a2a2a')}
                    onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Bottom save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, paddingBottom: 16 }}>
              {saveBtn}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
