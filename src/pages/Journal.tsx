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
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function emptyEntry(date: string): JournalEntry {
  return {
    id: uid(),
    date,
    premktImgKey: undefined,
    premktAnalysis: '',
    trades: [],
    emotion: undefined,
    postMarketNotes: '',
    updatedAt: '',
  }
}

function emptyTrade(): TradeLog {
  return { id: uid(), result: 'Win', entryPrice: '', exitPrice: '', confluences: [] }
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

const RESULTS: { value: TradeResult; label: string; activeBg: string; activeBorder: string; activeText: string }[] = [
  { value: 'Win',          label: 'Win',          activeBg: 'rgba(16,185,129,0.15)', activeBorder: '#34d399', activeText: '#6ee7b7'  },
  { value: 'Loss',         label: 'Loss',         activeBg: 'rgba(239,68,68,0.15)',  activeBorder: '#f87171', activeText: '#fca5a5'  },
  { value: 'BE',           label: 'BE',           activeBg: 'rgba(255,255,255,0.08)',activeBorder: '#4a4a4a', activeText: '#cccccc'  },
  { value: "Didn't take",  label: "Didn't Take",  activeBg: 'rgba(255,255,255,0.05)',activeBorder: '#333333', activeText: '#888888'  },
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

function ChartUpload({
  preview, onFile, onClear,
}: {
  preview: string | null
  onFile: (dataUrl: string) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result
      if (typeof result === 'string') onFile(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-[#2a2a2a] group">
          <img src={preview} alt="chart" className="w-full max-h-64 object-contain bg-black" />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-[#2a2a2a] hover:border-[#555] rounded-xl p-10 flex flex-col items-center gap-2 cursor-pointer transition-colors"
        >
          <ImageIcon size={24} className="text-[#444]" />
          <span className="text-sm text-[#444]">Click or drag a chart screenshot here</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

// ── Trade Card ────────────────────────────────────────────────────────────────

function TradeCard({
  trade, allTags, onUpdate, onRemove, onAddTag,
}: {
  trade: TradeLog
  allTags: string[]
  onUpdate: (t: TradeLog) => void
  onRemove: () => void
  onAddTag: (tag: string) => void
}) {
  const [newTag, setNewTag] = useState('')

  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => onUpdate({ ...trade, [k]: v })

  const toggleConfluence = (tag: string) => {
    const next = trade.confluences.includes(tag)
      ? trade.confluences.filter(t => t !== tag)
      : [...trade.confluences, tag]
    set('confluences', next)
  }

  const addTag = () => {
    const t = newTag.trim()
    if (!t) return
    onAddTag(t)
    if (!trade.confluences.includes(t)) set('confluences', [...trade.confluences, t])
    setNewTag('')
  }

  return (
    <div style={{ borderRadius: 16, border: '1px solid #222', background: '#111', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Result + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {RESULTS.map(r => {
            const active = trade.result === r.value
            return (
              <button
                key={r.value}
                onClick={() => set('result', r.value)}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${active ? r.activeBorder : '#2a2a2a'}`,
                  background: active ? r.activeBg : 'transparent',
                  color: active ? r.activeText : '#555',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <button onClick={onRemove} style={{ color: '#444', cursor: 'pointer', background: 'none', border: 'none', marginLeft: 8 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Prices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 6 }}>Entry Price</label>
          <input
            type="number"
            value={trade.entryPrice}
            onChange={e => set('entryPrice', e.target.value)}
            placeholder="0.00"
            style={{ width: '100%', background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f0f0', outline: 'none', boxSizing: 'border-box' as const }}
            onFocus={e => (e.target.style.borderColor = '#444')}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 6 }}>Exit Price</label>
          <input
            type="number"
            value={trade.exitPrice}
            onChange={e => set('exitPrice', e.target.value)}
            placeholder="0.00"
            style={{ width: '100%', background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f0f0', outline: 'none', boxSizing: 'border-box' as const }}
            onFocus={e => (e.target.style.borderColor = '#444')}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          />
        </div>
      </div>

      {/* Confluences */}
      <div>
        <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 8 }}>Confluences</label>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 }}>
          {allTags.map(tag => {
            const active = trade.confluences.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleConfluence(tag)}
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${active ? '#5a5a5a' : '#2a2a2a'}`,
                  background: active ? '#2a2a2a' : 'transparent',
                  color: active ? '#f0f0f0' : '#555',
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
            placeholder="Add confluence tag…"
            style={{ flex: 1, background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#f0f0f0', outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = '#444')}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          />
          <button
            onClick={addTag}
            style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#888', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2a2a2a'; e.currentTarget.style.color = '#f0f0f0' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.color = '#888' }}
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
}

export function Journal({ entries, confluenceTags, onSave, onAddConfluenceTag }: JournalProps) {
  const TODAY = todayStr()
  const [date, setDate] = useState(TODAY)
  const [form, setForm] = useState<JournalEntry>(() =>
    safeEntry(entries.find(e => e.date === TODAY), TODAY)
  )
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
    const toSave = { ...form, updatedAt: new Date().toISOString() }
    onSave(toSave)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const prev = () => setDate(d => shiftDate(d, -1))
  const next = () => { const n = shiftDate(date, 1); if (n <= TODAY) setDate(n) }

  const handleChartFile = (dataUrl: string) => {
    setChartPreview(dataUrl)
    patch('premktImgKey', dataUrl)
  }
  const clearChart = () => {
    setChartPreview(null)
    patch('premktImgKey', undefined)
  }

  const addTrade = () => patch('trades', [...form.trades, emptyTrade()])
  const updateTrade = (i: number, t: TradeLog) =>
    patch('trades', form.trades.map((x, idx) => idx === i ? t : x))
  const removeTrade = (i: number) =>
    patch('trades', form.trades.filter((_, idx) => idx !== i))

  const sidebarEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  const sectionHeader = (label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#666' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
    </div>
  )

  const textareaStyle: React.CSSProperties = {
    width: '100%', background: '#171717', border: '1px solid #2a2a2a', borderRadius: 12,
    padding: '12px 16px', fontSize: 14, color: '#f0f0f0', resize: 'none', outline: 'none',
    lineHeight: 1.6, boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>

      {/* Date Sidebar */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a', borderRight: '1px solid #1e1e1e', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={14} color="#555" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Daily Journal</span>
        </div>
        <button
          onClick={() => setDate(TODAY)}
          style={{
            textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #1e1e1e',
            background: date === TODAY ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: date === TODAY ? '#f0f0f0' : '#666',
            border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}
        >
          Today
        </button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarEntries.map(e => {
            const em = EMOTIONS.find(x => x.value === e.emotion)
            return (
              <button
                key={e.date}
                onClick={() => setDate(e.date)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 16px',
                  borderBottom: '1px solid #1a1a1a',
                  background: date === e.date ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: date === e.date ? '#f0f0f0' : '#666',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{formatShort(e.date)}</div>
                  <div style={{ fontSize: 10, color: '#3a3a3a', marginTop: 2 }}>
                    {e.trades.length} trade{e.trades.length !== 1 ? 's' : ''}
                  </div>
                </div>
                {em && <span style={{ fontSize: 16 }}>{em.emoji}</span>}
              </button>
            )
          })}
          {sidebarEntries.length === 0 && (
            <p style={{ fontSize: 11, color: '#333', textAlign: 'center', padding: 16 }}>No entries yet</p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#0d0d0d', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={prev} style={{ padding: 6, borderRadius: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666', cursor: 'pointer', display: 'flex' }}>
              <ChevronLeft size={15} />
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>{formatDate(date)}</div>
              {date === TODAY && <div style={{ fontSize: 10, color: '#555' }}>Today</div>}
            </div>
            <button
              onClick={next}
              disabled={date >= TODAY}
              style={{ padding: 6, borderRadius: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#666', cursor: date >= TODAY ? 'not-allowed' : 'pointer', opacity: date >= TODAY ? 0.3 : 1, display: 'flex' }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            onClick={save}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: saved ? 'rgba(16,185,129,0.2)' : '#f0f0f0',
              color: saved ? '#6ee7b7' : '#111',
              outline: saved ? '1px solid rgba(16,185,129,0.4)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <Save size={14} />
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 40 }}>

          {/* ─── PREMARKET ANALYSIS ─────────────────────── */}
          <section>
            {sectionHeader('Premarket Analysis')}
            <div style={{ borderRadius: 16, border: '1px solid #1e1e1e', background: '#0d0d0d', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChartUpload preview={chartPreview} onFile={handleChartFile} onClear={clearChart} />
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>Daily Analysis</label>
                <textarea
                  value={form.premktAnalysis}
                  onChange={e => patch('premktAnalysis', e.target.value)}
                  rows={5}
                  placeholder="Key levels, bias, market structure, what you're watching today…"
                  style={textareaStyle}
                  onFocus={e => (e.target.style.borderColor = '#444')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
                />
              </div>
            </div>
          </section>

          {/* ─── TRADE JOURNAL ──────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#666' }}>Trade Journal</span>
              <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
              <button
                onClick={addTrade}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1e1e1e', color: '#f0f0f0', border: '1px solid #333', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#2a2a2a' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1e1e1e' }}
              >
                <Plus size={13} /> Add Trade
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {form.trades.length === 0 && (
                <div style={{ background: '#0d0d0d', border: '2px dashed #1e1e1e', borderRadius: 16, padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ color: '#3a3a3a', fontSize: 14 }}>No trades logged yet — click Add Trade above</p>
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

          {/* ─── POST MARKET REVIEW ─────────────────────── */}
          <section>
            {sectionHeader('Post Market Review')}
            <div style={{ borderRadius: 16, border: '1px solid #1e1e1e', background: '#0d0d0d', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 10 }}>How are you feeling?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {EMOTIONS.map(em => {
                    const active = form.emotion === em.value
                    return (
                      <button
                        key={em.value}
                        onClick={() => patch('emotion', active ? undefined : em.value)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                          fontSize: 11, fontWeight: 500, transition: 'all 0.15s',
                          border: `1px solid ${active ? '#4a4a4a' : '#222'}`,
                          background: active ? 'rgba(255,255,255,0.08)' : '#111',
                          color: active ? '#f0f0f0' : '#555',
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{em.emoji}</span>
                        {em.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>Post Market Notes</label>
                <textarea
                  value={form.postMarketNotes}
                  onChange={e => patch('postMarketNotes', e.target.value)}
                  rows={5}
                  placeholder="What went well? What to improve? Key lessons from today…"
                  style={textareaStyle}
                  onFocus={e => (e.target.style.borderColor = '#444')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
                />
              </div>
            </div>
          </section>

          <div style={{ height: 32 }} />
        </div>
      </div>
    </div>
  )
}
