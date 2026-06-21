import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Save, Plus, Trash2, BookOpen, ImageIcon, X,
} from 'lucide-react'
import type { JournalEntry, TradeLog, TradeResult, Emotion } from '../types'

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
  return { id: uid(), date, premktImgKey: undefined, premktAnalysis: '', trades: [], emotion: undefined, postMarketNotes: '', updatedAt: '' }
}
function emptyTrade(): TradeLog {
  return { id: uid(), result: 'Win', symbol: '', side: 'Long', pnl: '', entryPrice: '', exitPrice: '', confluences: [] }
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
    trades: Array.isArray(r.trades) ? (r.trades as TradeLog[]).map(t => ({ ...emptyTrade(), ...t })) : [],
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = ['NQ', 'ES', 'GC', 'MNQ', 'MES', 'MGC']

const RESULTS: { value: TradeResult; label: string; color: string; activeBg: string }[] = [
  { value: 'Win',         label: 'Win',         color: '#4ade80', activeBg: 'rgba(74,222,128,0.12)'  },
  { value: 'Loss',        label: 'Loss',        color: '#f87171', activeBg: 'rgba(248,113,113,0.12)' },
  { value: 'BE',          label: 'BE',          color: '#aaaaaa', activeBg: 'rgba(170,170,170,0.1)'  },
  { value: "Didn't take", label: "Didn't Take", color: '#555555', activeBg: 'rgba(255,255,255,0.04)' },
]

const EMOTIONS: { value: Emotion; emoji: string; label: string }[] = [
  { value: 'very_happy',  emoji: '😄', label: 'Very Happy'  },
  { value: 'happy',       emoji: '🙂', label: 'Happy'       },
  { value: 'neutral',     emoji: '😐', label: 'Neutral'     },
  { value: 'frustrated',  emoji: '😕', label: 'Frustrated'  },
  { value: 'angry',       emoji: '😤', label: 'Angry'       },
  { value: 'very_angry',  emoji: '😡', label: 'Very Angry'  },
]

// ── Collapsible Section ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  badge,
  action,
  defaultOpen = true,
  children,
}: {
  title: string
  badge?: string
  action?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid #1a1a1a',
        overflow: 'hidden',
        background: '#0f0f0f',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header — always visible, acts as toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          minHeight: 50,
          borderBottom: open ? '1px solid #181818' : '1px solid transparent',
          transition: 'border-color 0.25s ease',
        }}
      >
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '12px 0',
            textAlign: 'left',
          }}
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            style={{
              color: '#444',
              flexShrink: 0,
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: open ? '#777' : '#444', transition: 'color 0.2s' }}>
            {title}
          </span>
          {badge && (
            <span style={{ fontSize: 11, color: '#333', fontWeight: 400 }}>
              {badge}
            </span>
          )}
        </button>
        {/* Action slot (only shown when open) */}
        <div
          style={{
            opacity: open ? 1 : 0,
            transform: open ? 'translateX(0)' : 'translateX(6px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          {action}
        </div>
      </div>

      {/* Content — smooth grid collapse */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 24px', background: '#0a0a0a' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Chart Upload ──────────────────────────────────────────────────────────────

function ChartUpload({ preview, onFile, onClear }: { preview: string | null; onFile: (url: string) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => { if (typeof e.target?.result === 'string') onFile(e.target.result) }
    reader.readAsDataURL(file)
  }
  return (
    <div>
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #222' }}>
          <img src={preview} alt="chart" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', background: '#000', display: 'block' }} />
          <button
            onClick={onClear}
            style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.75)')}
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed #1e1e1e', borderRadius: 12, padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e1e')}
        >
          <ImageIcon size={22} color="#2a2a2a" />
          <span style={{ fontSize: 13, color: '#3a3a3a' }}>Click or drag a chart screenshot here</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Trade Card ────────────────────────────────────────────────────────────────

function TradeCard({ trade, allTags, onUpdate, onRemove, onAddTag }: {
  trade: TradeLog; allTags: string[]
  onUpdate: (t: TradeLog) => void; onRemove: () => void; onAddTag: (tag: string) => void
}) {
  const [newTag, setNewTag] = useState('')
  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => onUpdate({ ...trade, [k]: v })

  const toggleConfluence = (tag: string) => {
    set('confluences', trade.confluences.includes(tag)
      ? trade.confluences.filter(t => t !== tag)
      : [...trade.confluences, tag])
  }
  const addTag = () => {
    const t = newTag.trim(); if (!t) return
    onAddTag(t)
    if (!trade.confluences.includes(t)) set('confluences', [...trade.confluences, t])
    setNewTag('')
  }

  const inputBase: React.CSSProperties = {
    background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 10,
    padding: '9px 12px', fontSize: 13, color: '#e0e0e0', outline: 'none',
    width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  }

  const pnlVal = parseFloat(trade.pnl)
  const pnlColor = pnlVal > 0 ? '#4ade80' : pnlVal < 0 ? '#f87171' : '#e0e0e0'

  return (
    <div
      style={{
        borderRadius: 14, border: '1px solid #1a1a1a', background: '#0d0d0d',
        padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 16,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#222')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
    >
      {/* Result + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RESULTS.map(r => {
            const active = trade.result === r.value
            return (
              <button
                key={r.value}
                onClick={() => set('result', r.value)}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${active ? r.color + '55' : '#1e1e1e'}`,
                  background: active ? r.activeBg : 'transparent',
                  color: active ? r.color : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#2a2a2a', cursor: 'pointer', padding: 4, display: 'flex', transition: 'color 0.15s', marginLeft: 8 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#2a2a2a')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Symbol + Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Symbol</label>
          <select
            value={trade.symbol}
            onChange={e => set('symbol', e.target.value)}
            style={{ ...inputBase, cursor: 'pointer' }}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          >
            <option value="">Select…</option>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Side</label>
          <div style={{ display: 'flex', gap: 6, height: 38 }}>
            {(['Long', 'Short'] as const).map(side => {
              const active = trade.side === side
              const c = side === 'Long' ? '#4ade80' : '#f87171'
              const bg = side === 'Long' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)'
              return (
                <button key={side} onClick={() => set('side', side)}
                  style={{
                    flex: 1, borderRadius: 10, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? c + '44' : '#1e1e1e'}`,
                    background: active ? bg : 'transparent',
                    color: active ? c : '#3a3a3a',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
                >
                  {side}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Entry | Exit | P&L */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {([
          { key: 'entryPrice' as const, label: 'Entry Price' },
          { key: 'exitPrice'  as const, label: 'Exit Price'  },
          { key: 'pnl'        as const, label: 'P&L ($)'    },
        ]).map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
            <input
              type="number"
              value={trade[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder="0.00"
              style={{ ...inputBase, color: f.key === 'pnl' ? pnlColor : '#e0e0e0' }}
              onFocus={e => (e.target.style.borderColor = '#333')}
              onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
            />
          </div>
        ))}
      </div>

      {/* Confluences */}
      <div>
        <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Confluences</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {allTags.map(tag => {
            const active = trade.confluences.includes(tag)
            return (
              <button key={tag} onClick={() => toggleConfluence(tag)}
                style={{
                  padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${active ? '#333' : '#1a1a1a'}`,
                  background: active ? '#1e1e1e' : 'transparent',
                  color: active ? '#ccc' : '#3a3a3a',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()}
            placeholder="Add tag…"
            style={{ flex: 1, ...inputBase }}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          />
          <button onClick={addTag}
            style={{ background: '#131313', border: '1px solid #1e1e1e', color: '#444', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', display: 'flex', transition: 'all 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#131313'; e.currentTarget.style.color = '#444' }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Journal ──────────────────────────────────────────────────────────────

interface JournalProps {
  entries: JournalEntry[]
  confluenceTags: string[]
  onSave: (entry: JournalEntry) => void
  onAddConfluenceTag: (tag: string) => void
  onDeleteConfluenceTag: (tag: string) => void
  initialDate?: string
}

export function Journal({ entries, confluenceTags, onSave, onAddConfluenceTag, initialDate }: JournalProps) {
  const TODAY = todayStr()
  const [date, setDate] = useState(initialDate || TODAY)
  const [form, setForm] = useState<JournalEntry>(() => safeEntry(entries.find(e => e.date === (initialDate || TODAY)), initialDate || TODAY))
  const [chartPreview, setChartPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const found = entries.find(e => e.date === date)
    const entry = safeEntry(found, date)
    setForm(entry)
    setChartPreview(entry.premktImgKey?.startsWith('data:') ? entry.premktImgKey : null)
    setSaved(false)
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = <K extends keyof JournalEntry>(k: K, v: JournalEntry[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const save = () => {
    onSave({ ...form, updatedAt: new Date().toISOString() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const prev = () => setDate(d => shiftDate(d, -1))
  const next = () => { const n = shiftDate(date, 1); if (n <= TODAY) setDate(n) }

  const handleChartFile = (url: string) => { setChartPreview(url); patch('premktImgKey', url) }
  const clearChart = () => { setChartPreview(null); patch('premktImgKey', undefined) }

  const addTrade = () => patch('trades', [...form.trades, emptyTrade()])
  const updateTrade = (i: number, t: TradeLog) => patch('trades', form.trades.map((x, idx) => idx === i ? t : x))
  const removeTrade = (i: number) => patch('trades', form.trades.filter((_, idx) => idx !== i))

  const sidebarEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  const tradeCount = form.trades.filter(t => t.result !== "Didn't take").length

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

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* ── Date Sidebar ────────────────────────────────────────── */}
      <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#060606', borderRight: '1px solid #141414', overflow: 'hidden' }}>
        <div style={{ padding: '13px 14px 11px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 7 }}>
          <BookOpen size={12} color="#333" strokeWidth={1.8} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Entries</span>
        </div>
        <button
          onClick={() => setDate(TODAY)}
          style={{
            textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid #0e0e0e',
            background: date === TODAY ? 'rgba(255,255,255,0.04)' : 'transparent',
            color: date === TODAY ? '#e0e0e0' : '#3a3a3a',
            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
          }}
          onMouseEnter={e => { if (date !== TODAY) e.currentTarget.style.color = '#777' }}
          onMouseLeave={e => { if (date !== TODAY) e.currentTarget.style.color = '#3a3a3a' }}
        >
          Today
        </button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarEntries.map(e => {
            const em = EMOTIONS.find(x => x.value === e.emotion)
            const isActive = date === e.date
            const count = e.trades.filter(t => t.result !== "Didn't take").length
            return (
              <button
                key={e.date}
                onClick={() => setDate(e.date)}
                style={{
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
                  <div style={{ fontSize: 10, color: '#2a2a2a', marginTop: 2 }}>
                    {count} trade{count !== 1 ? 's' : ''}
                  </div>
                </div>
                {em && <span style={{ fontSize: 14 }}>{em.emoji}</span>}
              </button>
            )
          })}
          {sidebarEntries.length === 0 && (
            <p style={{ fontSize: 11, color: '#1e1e1e', textAlign: 'center', padding: '20px 12px', margin: 0 }}>No entries yet</p>
          )}
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 54, background: '#070707', borderBottom: '1px solid #141414' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={prev} style={navBtnBase}
              onMouseEnter={e => { e.currentTarget.style.color = '#e0e0e0'; e.currentTarget.style.borderColor = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' }}
            >
              <ChevronLeft size={14} strokeWidth={1.8} />
            </button>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', lineHeight: 1.2 }}>{formatDate(date)}</div>
              {date === TODAY && <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>Today</div>}
            </div>
            <button
              onClick={next}
              disabled={date >= TODAY}
              style={{ ...navBtnBase, opacity: date >= TODAY ? 0.25 : 1, cursor: date >= TODAY ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (date < TODAY) { e.currentTarget.style.color = '#e0e0e0'; e.currentTarget.style.borderColor = '#333' } }}
              onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' }}
            >
              <ChevronRight size={14} strokeWidth={1.8} />
            </button>
          </div>

          <button
            onClick={save}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: saved ? 'rgba(74,222,128,0.12)' : '#f0f0f0',
              color: saved ? '#4ade80' : '#111',
              outline: saved ? '1px solid rgba(74,222,128,0.25)' : 'none',
              transition: 'all 0.2s ease', fontFamily: 'inherit',
            }}
          >
            <Save size={13} strokeWidth={2} />
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 48px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ── Premarket Analysis ─────────────────────────────── */}
            <CollapsibleSection title="Premarket Analysis">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ChartUpload preview={chartPreview} onFile={handleChartFile} onClear={clearChart} />
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

            {/* ── Trade Journal ───────────────────────────────────── */}
            <CollapsibleSection
              title="Trade Journal"
              badge={tradeCount > 0 ? `· ${tradeCount} trade${tradeCount !== 1 ? 's' : ''}` : undefined}
              action={
                <button
                  onClick={addTrade}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, background: '#141414',
                    color: '#bbb', border: '1px solid #222', borderRadius: 8,
                    padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#f0f0f0' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#bbb' }}
                >
                  <Plus size={12} strokeWidth={2.5} /> Add Trade
                </button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.trades.length === 0 ? (
                  <div
                    style={{ border: '2px dashed #151515', borderRadius: 12, padding: '32px 16px', textAlign: 'center', cursor: 'pointer' }}
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
                      allTags={confluenceTags}
                      onUpdate={t => updateTrade(i, t)}
                      onRemove={() => removeTrade(i)}
                      onAddTag={onAddConfluenceTag}
                    />
                  ))
                )}
              </div>
            </CollapsibleSection>

            {/* ── Post Market Review ──────────────────────────────── */}
            <CollapsibleSection title="Post Market Review">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: '#444', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>How are you feeling?</label>
                  {/* Emotions in a single no-wrap row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                    {EMOTIONS.map(em => {
                      const active = form.emotion === em.value
                      return (
                        <button
                          key={em.value}
                          onClick={() => patch('emotion', active ? undefined : em.value)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                            fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
                            border: `1px solid ${active ? '#333' : '#161616'}`,
                            background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                            color: active ? '#e0e0e0' : '#333',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            fontFamily: 'inherit',
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

          </div>
        </div>
      </div>
    </div>
  )
}
