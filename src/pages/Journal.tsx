import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, Save, Plus, Trash2, BookOpen, ImageIcon, X,
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

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    trades: Array.isArray(r.trades)
      ? (r.trades as TradeLog[]).map(t => ({ ...emptyTrade(), ...t }))
      : [],
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = ['NQ', 'ES', 'GC', 'MNQ', 'MES', 'MGC']

const RESULTS: { value: TradeResult; label: string; color: string; activeBg: string }[] = [
  { value: 'Win',         label: 'Win',          color: '#4ade80', activeBg: 'rgba(74,222,128,0.12)'  },
  { value: 'Loss',        label: 'Loss',         color: '#f87171', activeBg: 'rgba(248,113,113,0.12)' },
  { value: 'BE',          label: 'BE',           color: '#aaaaaa', activeBg: 'rgba(170,170,170,0.1)'  },
  { value: "Didn't take", label: "Didn't Take",  color: '#555555', activeBg: 'rgba(255,255,255,0.04)' },
]

const EMOTIONS: { value: Emotion; emoji: string; label: string }[] = [
  { value: 'very_happy',  emoji: '😄', label: 'Very Happy'  },
  { value: 'happy',       emoji: '🙂', label: 'Happy'       },
  { value: 'neutral',     emoji: '😐', label: 'Neutral'     },
  { value: 'frustrated',  emoji: '😕', label: 'Frustrated'  },
  { value: 'angry',       emoji: '😤', label: 'Angry'       },
  { value: 'very_angry',  emoji: '😡', label: 'Very Angry'  },
]

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
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2a2a' }} className="group">
          <img src={preview} alt="chart" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', background: '#000', display: 'block' }} />
          <button
            onClick={onClear}
            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.7)')}
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed #2a2a2a', borderRadius: 12, padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#444')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
        >
          <ImageIcon size={22} color="#333" />
          <span style={{ fontSize: 13, color: '#444' }}>Click or drag a chart screenshot here</span>
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

  const inputStyle: React.CSSProperties = {
    background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: 10,
    padding: '9px 12px', fontSize: 13, color: '#f0f0f0', outline: 'none',
    width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid #1e1e1e', background: '#111', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, transition: 'border-color 0.15s' }}>

      {/* Row 1: Result buttons + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {RESULTS.map(r => {
            const active = trade.result === r.value
            return (
              <button
                key={r.value}
                onClick={() => set('result', r.value)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${active ? r.color + '60' : '#222'}`,
                  background: active ? r.activeBg : 'transparent',
                  color: active ? r.color : '#555',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#888' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#555' }}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: 4, display: 'flex', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#333')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Row 2: Symbol + Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 6, fontWeight: 500 }}>Symbol</label>
          <select
            value={trade.symbol}
            onChange={e => set('symbol', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
            onFocus={e => (e.target.style.borderColor = '#444')}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          >
            <option value="">Select…</option>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 6, fontWeight: 500 }}>Side</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['Long', 'Short'] as const).map(side => {
              const active = trade.side === side
              const color = side === 'Long' ? '#4ade80' : '#f87171'
              const activeBg = side === 'Long' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)'
              return (
                <button
                  key={side}
                  onClick={() => set('side', side)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? color + '50' : '#222'}`,
                    background: active ? activeBg : 'transparent',
                    color: active ? color : '#555',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {side}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Entry | Exit | P&L */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {([
          { key: 'entryPrice', label: 'Entry Price' },
          { key: 'exitPrice', label: 'Exit Price' },
          { key: 'pnl', label: 'P&L ($)' },
        ] as const).map(field => (
          <div key={field.key}>
            <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 6, fontWeight: 500 }}>{field.label}</label>
            <input
              type="number"
              value={trade[field.key]}
              onChange={e => set(field.key, e.target.value)}
              placeholder={field.key === 'pnl' ? '0.00' : '0.00'}
              style={{
                ...inputStyle,
                color: field.key === 'pnl'
                  ? (parseFloat(trade.pnl) > 0 ? '#4ade80' : parseFloat(trade.pnl) < 0 ? '#f87171' : '#f0f0f0')
                  : '#f0f0f0',
              }}
              onFocus={e => (e.target.style.borderColor = '#444')}
              onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
            />
          </div>
        ))}
      </div>

      {/* Row 4: Confluences */}
      <div>
        <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 8, fontWeight: 500 }}>Confluences</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {allTags.map(tag => {
            const active = trade.confluences.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleConfluence(tag)}
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                  border: `1px solid ${active ? '#4a4a4a' : '#1e1e1e'}`,
                  background: active ? '#222' : 'transparent',
                  color: active ? '#f0f0f0' : '#444',
                  cursor: 'pointer', transition: 'all 0.15s',
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
            style={{ flex: 1, background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#f0f0f0', outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
          />
          <button
            onClick={addTag}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#f0f0f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#666' }}
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

  const handleChartFile = (dataUrl: string) => { setChartPreview(dataUrl); patch('premktImgKey', dataUrl) }
  const clearChart = () => { setChartPreview(null); patch('premktImgKey', undefined) }

  const addTrade = () => patch('trades', [...form.trades, emptyTrade()])
  const updateTrade = (i: number, t: TradeLog) => patch('trades', form.trades.map((x, idx) => idx === i ? t : x))
  const removeTrade = (i: number) => patch('trades', form.trades.filter((_, idx) => idx !== i))

  const sidebarEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  const textareaStyle: React.CSSProperties = {
    width: '100%', background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
    padding: '12px 16px', fontSize: 14, color: '#f0f0f0', resize: 'none',
    outline: 'none', lineHeight: 1.65, boxSizing: 'border-box', transition: 'border-color 0.15s',
  }

  const sectionLabel = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#555', whiteSpace: 'nowrap' as const }}>
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* Date Sidebar */}
      <div style={{ width: 192, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a', borderRight: '1px solid #181818', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #181818', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={13} color="#444" />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Journal</span>
        </div>
        <button
          onClick={() => setDate(TODAY)}
          style={{
            textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #151515',
            background: date === TODAY ? 'rgba(255,255,255,0.05)' : 'transparent',
            color: date === TODAY ? '#f0f0f0' : '#555', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
          }}
        >
          Today
        </button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarEntries.map(e => {
            const em = EMOTIONS.find(x => x.value === e.emotion)
            const isActive = date === e.date
            const tradeCount = e.trades.filter(t => t.result !== "Didn't take").length
            return (
              <button
                key={e.date}
                onClick={() => setDate(e.date)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 16px',
                  borderBottom: '1px solid #141414',
                  background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? '#f0f0f0' : '#666' }}>{formatShort(e.date)}</div>
                  <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>
                    {tradeCount} trade{tradeCount !== 1 ? 's' : ''}
                  </div>
                </div>
                {em && <span style={{ fontSize: 15 }}>{em.emoji}</span>}
              </button>
            )
          })}
          {sidebarEntries.length === 0 && (
            <p style={{ fontSize: 11, color: '#2a2a2a', textAlign: 'center', padding: '20px 16px' }}>No entries yet</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#0d0d0d', borderBottom: '1px solid #181818' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={prev}
              style={{ padding: 6, borderRadius: 8, background: '#171717', border: '1px solid #222', color: '#555', cursor: 'pointer', display: 'flex', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f0f0f0'; e.currentTarget.style.borderColor = '#3a3a3a' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222' }}
            >
              <ChevronLeft size={14} />
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>{formatDate(date)}</div>
              {date === TODAY && <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>Today</div>}
            </div>
            <button
              onClick={next}
              disabled={date >= TODAY}
              style={{ padding: 6, borderRadius: 8, background: '#171717', border: '1px solid #222', color: '#555', cursor: date >= TODAY ? 'not-allowed' : 'pointer', opacity: date >= TODAY ? 0.3 : 1, display: 'flex', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (date < TODAY) { e.currentTarget.style.color = '#f0f0f0'; e.currentTarget.style.borderColor = '#3a3a3a' } }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={save}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: saved ? 'rgba(74,222,128,0.15)' : '#f0f0f0',
              color: saved ? '#4ade80' : '#111',
              outline: saved ? '1px solid rgba(74,222,128,0.3)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Save size={14} />
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* Premarket Analysis */}
          <section>
            {sectionLabel('Premarket Analysis')}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChartUpload preview={chartPreview} onFile={handleChartFile} onClear={clearChart} />
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 6, fontWeight: 500 }}>Daily Analysis</label>
                <textarea
                  value={form.premktAnalysis}
                  onChange={e => patch('premktAnalysis', e.target.value)}
                  rows={5}
                  placeholder="Key levels, bias, market structure, what you're watching today…"
                  style={textareaStyle}
                  onFocus={e => (e.target.style.borderColor = '#333')}
                  onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                />
              </div>
            </div>
          </section>

          {/* Trade Journal */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#555', whiteSpace: 'nowrap' }}>Trade Journal</span>
              <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
              <button
                onClick={addTrade}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, background: '#1a1a1a', color: '#f0f0f0',
                  border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 14px', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.borderColor = '#3a3a3a' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = '#2a2a2a' }}
              >
                <Plus size={12} /> Add Trade
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {form.trades.length === 0 && (
                <div style={{ background: '#0d0d0d', border: '2px dashed #1a1a1a', borderRadius: 14, padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ color: '#2a2a2a', fontSize: 13, margin: 0 }}>No trades logged yet — click Add Trade above</p>
                </div>
              )}
              {form.trades.map((trade, i) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  allTags={confluenceTags}
                  onUpdate={t => updateTrade(i, t)}
                  onRemove={() => removeTrade(i)}
                  onAddTag={onAddConfluenceTag}
                />
              ))}
            </div>
          </section>

          {/* Post Market Review */}
          <section>
            {sectionLabel('Post Market Review')}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 10, fontWeight: 500 }}>How are you feeling?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {EMOTIONS.map(em => {
                    const active = form.emotion === em.value
                    return (
                      <button
                        key={em.value}
                        onClick={() => patch('emotion', active ? undefined : em.value)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                          fontSize: 11, fontWeight: 500, transition: 'all 0.15s',
                          border: `1px solid ${active ? '#3a3a3a' : '#1e1e1e'}`,
                          background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                          color: active ? '#f0f0f0' : '#444',
                        }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#888' } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#444' } }}
                      >
                        <span style={{ fontSize: 22 }}>{em.emoji}</span>
                        {em.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 6, fontWeight: 500 }}>Post Market Notes</label>
                <textarea
                  value={form.postMarketNotes}
                  onChange={e => patch('postMarketNotes', e.target.value)}
                  rows={5}
                  placeholder="What went well? What to improve? Key lessons from today…"
                  style={textareaStyle}
                  onFocus={e => (e.target.style.borderColor = '#333')}
                  onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                />
              </div>
            </div>
          </section>

          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  )
}
