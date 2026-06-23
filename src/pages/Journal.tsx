import { useState, useEffect, useRef } from 'react'
import {
  Plus, Trash2, ImageIcon, X, Search, Save, ChevronDown, BookOpen,
} from 'lucide-react'
import type { JournalEntry, TradeLog, TradeResult, TradingRule, TradingAccount } from '../types'
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
    entryPrice: '', exitPrice: '', targetPrice: '',
    takeProfit: '', stopLoss: '',
    pnl: '', fees: '', drawdown: '',
    duration: '', tradeNumber: '',
    confluences: [], sessions: [], dol: [],
    htfImgKey: undefined, execImgKey: undefined,
    setup: '', grade: '', time: '', notes: '',
    // ICT context
    htfBias: '',
    internalRangeLiquidity: [],
    externalRangeLiquidity: [],
    liquiditySwept: [],
    smtPresent: [],
    cisdPresent: [],
    displacement: '',
    fvgPresent: [],
    ifvgPresent: [],
    rejectionBlock: [],
    entryModel: '',
    setupType: '',
    timeframeExecuted: '',
    marketCondition: '',
    exitReason: [],
    newsPresent: '',
    newsType: '',
    screenshots: [],
    orderBlock: [],
    bprPresent: [],
    stdvPresent: [],
    otePresent: [],
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

// ── Auto-grade ────────────────────────────────────────────────────────────────

function calcSetupGrade(t: TradeLog): { grade: string; score: number } | null {
  let score = 0
  if (t.htfBias) score += 1
  score += Math.min((t.dol || []).length, 3)
  score += Math.min((t.internalRangeLiquidity || []).length, 2)
  score += Math.min((t.externalRangeLiquidity || []).length, 2)
  if ((t.liquiditySwept || []).length > 0) score += 1
  if ((t.smtPresent || []).length > 0) score += 1
  if ((t.cisdPresent || []).length > 0) score += 1
  if (t.displacement === 'Yes') score += 1
  if ((t.fvgPresent || []).length > 0) score += 1
  if ((t.ifvgPresent || []).length > 0) score += 1
  if ((t.rejectionBlock || []).length > 0) score += 1
  if ((t.orderBlock || []).length > 0) score += 1
  if ((t.bprPresent || []).length > 0) score += 1
  if ((t.stdvPresent || []).length > 0) score += 1
  if ((t.otePresent || []).length > 0) score += 1
  if (t.timeframeExecuted) score += 1
  score += Math.min((t.confluences || []).length, 3)
  if (score === 0) return null
  let grade: string
  if (score >= 10) grade = 'A+'
  else if (score >= 8) grade = 'A'
  else if (score >= 6) grade = 'B'
  else if (score >= 4) grade = 'C'
  else if (score >= 2) grade = 'D'
  else grade = 'F'
  return { grade, score }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = ['NQ', 'ES', 'GC', 'MNQ', 'MES', 'MGC']
const CONFLUENCE_BASES = ['Rejection Block', 'Order Block', 'FVG', 'iFVG', 'CISD', 'BPR', 'STDV', 'OTE']
const TIMEFRAMES = ['1m', '2m', '3m', '4m', '5m', '15m', '30m', '1hr', '4hr', 'Daily']
const STDV_LEVELS = ['+0.5', '+1', '+1.5', '+2', '+2.5', '-0.5', '-1', '-1.5', '-2', '-2.5']
const STDV_CONTEXT_LEVELS = ['-1', '-2 to -2.5', '-4 to -4.5']

const RESULTS: { value: TradeResult; label: string; color: string; bg: string }[] = [
  { value: 'Win',   label: 'Win',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  { value: 'Loss',  label: 'Loss',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  { value: 'BE',    label: 'BE',    color: '#aaaaaa', bg: 'rgba(170,170,170,0.1)'  },
  { value: 'Faded', label: 'Faded', color: '#fb923c', bg: 'rgba(251,146,60,0.1)'   },
]
const RESULT_COLORS: Record<string, string> = { Win: '#4ade80', Loss: '#f87171', BE: '#aaaaaa', Faded: '#fb923c' }

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F']
const GRADE_COLORS: Record<string, string> = { 'A+': '#4ade80', A: '#86efac', B: '#fbbf24', C: '#fb923c', D: '#f87171', F: '#ef4444' }

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
const MODAL_DOL_OPTIONS = [
  'Asia High', 'Asia Low', 'London High', 'London Low',
  'New York AM High', 'New York AM Low', 'New York PM High', 'New York PM Low',
]
const EXIT_REASONS = ['Full TP', 'Swept Internal High/Low', 'SMT']

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 8,
  padding: '10px 13px', fontSize: 16, color: '#f0f0f0', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}
const fieldLabel = (text: string) => (
  <div style={{ fontSize: 13, color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{text}</div>
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
          style={{ border: '2px dashed #1a1a1a', borderRadius: 8, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#333')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
        >
          <ImageIcon size={16} color="#555" />
          <span style={{ fontSize: 12, color: '#555' }}>Click or drag image</span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handle(f) }} />
    </div>
  )
}

// ── Shared pill / tag helpers ─────────────────────────────────────────────────

function PillBtn({ label, active, onClick, activeColor, activeBg }: {
  label: string; active: boolean; onClick: () => void; activeColor: string; activeBg: string
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      border: `1px solid ${active ? activeColor + '55' : '#1e1e1e'}`,
      background: active ? activeBg : 'transparent',
      color: active ? activeColor : '#666',
      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#aaa' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#666' }}
    >{label}</button>
  )
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
      border: `1px solid ${active ? '#4a4a4a' : '#222'}`,
      background: active ? '#252525' : 'transparent',
      color: active ? '#f0f0f0' : '#666',
      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.borderColor = '#333' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#222' } }}
    >{label}</button>
  )
}

// ── Confluence Wizard (step-through) ─────────────────────────────────────────

function ConfluenceWizard({ confluences, onChange }: {
  confluences: string[]
  onChange: (next: string[]) => void
}) {
  const [step, setStep] = useState<number | null>(null)

  const STEPS = CONFLUENCE_BASES
  const total = STEPS.length

  const toggle = (tag: string) => {
    onChange(confluences.includes(tag) ? confluences.filter(t => t !== tag) : [...confluences, tag])
  }

  // Collapsed view
  if (step === null) {
    return (
      <div>
        {confluences.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {confluences.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 12, background: '#1e1e1e', border: '1px solid #333', color: '#e0e0e0' }}>
                {tag}
                <button onClick={() => toggle(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#666', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                ><X size={9} /></button>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => setStep(0)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, border: '1px dashed #222', background: 'transparent',
            color: '#555', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222' }}
        >
          {confluences.length > 0 ? '✏ Edit Confluences' : '+ Add Confluences'}
        </button>
      </div>
    )
  }

  // Wizard step view
  const current = STEPS[step]
  const pct = Math.round(((step + 1) / total) * 100)

  return (
    <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
      {/* Step header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#d0d0d0' }}>{current}</span>
        <span style={{ fontSize: 11, color: '#444', fontWeight: 600 }}>{step + 1} / {total}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: '#1a1a1a', borderRadius: 999, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#4ade80', borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>

      {/* Timeframe options */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {TIMEFRAMES.map(tf => {
          const combo = `${current} (${tf})`
          const sel = confluences.includes(combo)
          return (
            <button key={tf} onClick={() => toggle(combo)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
              background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
              color: sel ? '#4ade80' : '#666',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}>{tf}</button>
          )
        })}
        {current === 'STDV' && STDV_LEVELS.map(lv => {
          const tag = `STDV ${lv}σ`
          const sel = confluences.includes(tag)
          return (
            <button key={lv} onClick={() => toggle(tag)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
              background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
              color: sel ? '#4ade80' : '#666',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}>{lv}σ</button>
          )
        })}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => { if (step === 0) setStep(null); else setStep(s => (s ?? 1) - 1) }}
          style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #1e1e1e', background: 'transparent', color: '#555', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#2a2a2a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#1e1e1e' }}
        >{step === 0 ? '✕ Close' : '← Back'}</button>
        <div style={{ flex: 1 }} />
        {step < total - 1 ? (
          <>
            <button onClick={() => setStep(s => (s ?? 0) + 1)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #1e1e1e', background: 'transparent', color: '#555', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#aaa' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
            >Skip</button>
            <button onClick={() => setStep(s => (s ?? 0) + 1)} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', background: '#f0f0f0', color: '#111', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f0f0f0' }}
            >Next →</button>
          </>
        ) : (
          <button onClick={() => setStep(null)} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            Done ✓
          </button>
        )}
      </div>

      {/* Selected summary at bottom */}
      {confluences.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #141414' }}>
          <div style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Selected</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {confluences.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px 2px 8px', borderRadius: 999, fontSize: 11, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc' }}>
                {tag}
                <button onClick={() => toggle(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#555', display: 'flex', lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                ><X size={8} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Timeframe Tag Picker (for ICT context fields) ─────────────────────────────

function TFTagPicker({ bases, selected, onChange }: {
  bases: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [activePicker, setActivePicker] = useState<string | null>(null)

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {selected.map(tag => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 12, background: '#1e1e1e', border: '1px solid #333', color: '#e0e0e0' }}>
              {tag}
              <button onClick={() => toggle(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#666', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = '#666')}
              ><X size={9} /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: activePicker ? 8 : 0 }}>
        {bases.map(base => {
          const hasAny = selected.some(s => s.startsWith(`${base} (`))
          const isOpen = activePicker === base
          return (
            <button key={base} onClick={() => setActivePicker(isOpen ? null : base)} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              border: `1px solid ${hasAny || isOpen ? '#4a4a4a' : '#222'}`,
              background: hasAny || isOpen ? '#252525' : 'transparent',
              color: hasAny || isOpen ? '#f0f0f0' : '#666',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}
              onMouseEnter={e => { if (!hasAny && !isOpen) { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.borderColor = '#333' } }}
              onMouseLeave={e => { if (!hasAny && !isOpen) { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#222' } }}
            >{base}</button>
          )
        })}
      </div>
      {activePicker && (
        <div style={{ padding: '8px 12px', background: '#111', borderRadius: 10, border: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Timeframe</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {TIMEFRAMES.map(tf => {
              const combo = `${activePicker} (${tf})`
              const sel = selected.includes(combo)
              return (
                <button key={tf} onClick={() => toggle(combo)} style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                  border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                  background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
                  color: sel ? '#4ade80' : '#666',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                }}>{tf}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Collapsible Section Header ────────────────────────────────────────────────

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      background: 'none', border: 'none', cursor: 'pointer', padding: '22px 0 0', margin: 0,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: open ? '#aaa' : '#666', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
      <ChevronDown size={13} color="#555" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
    </button>
  )
}

// ── ICT Context Wizard ────────────────────────────────────────────────────────

type ICTFields = {
  smtPresent: string[]
  cisdPresent: string[]
  displacement: string
  fvgPresent: string[]
  ifvgPresent: string[]
  rejectionBlock: string[]
  orderBlock: string[]
  bprPresent: string[]
  otePresent: string[]
  stdvPresent: string[]
}

const ICT_STEPS: { key: keyof ICTFields; label: string; type: 'tf' | 'yesno' | 'stdv'; bases?: string[] }[] = [
  { key: 'smtPresent',     label: 'SMT Present',     type: 'tf',    bases: ['SMT']  },
  { key: 'cisdPresent',    label: 'CISD Present',    type: 'tf',    bases: ['CISD'] },
  { key: 'displacement',   label: 'Displacement',    type: 'yesno'                  },
  { key: 'fvgPresent',     label: 'FVG Present',     type: 'tf',    bases: ['FVG']  },
  { key: 'ifvgPresent',    label: 'iFVG Present',    type: 'tf',    bases: ['iFVG'] },
  { key: 'rejectionBlock', label: 'Rejection Block', type: 'tf',    bases: ['RB']   },
  { key: 'orderBlock',     label: 'Order Block',     type: 'tf',    bases: ['OB']   },
  { key: 'bprPresent',     label: 'BPR',             type: 'tf',    bases: ['BPR']  },
  { key: 'otePresent',     label: 'OTE',             type: 'tf',    bases: ['OTE']  },
  { key: 'stdvPresent',    label: 'STDV',            type: 'stdv'                   },
]

function ICTWizard({ fields, onChange }: {
  fields: ICTFields
  onChange: (key: string, value: string[] | string) => void
}) {
  const [step, setStep] = useState<number | null>(null)

  const toggleTag = (key: string, arr: string[], tag: string) => {
    onChange(key, arr.includes(tag) ? arr.filter(t => t !== tag) : [...arr, tag])
  }

  // Build flat list of all selected items with their removal actions
  const allChips: { label: string; remove: () => void }[] = []
  if (fields.displacement) {
    const v = fields.displacement
    allChips.push({ label: `Displacement: ${v}`, remove: () => onChange('displacement', '') })
  }
  const arrFieldKeys = ['smtPresent', 'cisdPresent', 'fvgPresent', 'ifvgPresent', 'rejectionBlock', 'orderBlock', 'bprPresent', 'otePresent', 'stdvPresent'] as const
  for (const fk of arrFieldKeys) {
    const arr = (fields[fk] as string[]) || []
    for (const tag of arr) {
      const captured = { fk, arr: arr.slice() }
      allChips.push({ label: tag, remove: () => onChange(captured.fk, captured.arr.filter(t => t !== tag)) })
    }
  }

  // Collapsed view
  if (step === null) {
    return (
      <div>
        {allChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {allChips.map((chip, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 12, background: '#1e1e1e', border: '1px solid #333', color: '#e0e0e0' }}>
                {chip.label}
                <button onClick={chip.remove} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#666', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                ><X size={9} /></button>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => setStep(0)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px dashed #222', background: 'transparent', color: '#555', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#3a3a3a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222' }}
        >{allChips.length > 0 ? '✏ Edit ICT Context' : '+ Add ICT Context'}</button>
      </div>
    )
  }

  // Wizard view
  const curStep = ICT_STEPS[step]
  const total = ICT_STEPS.length
  const pct = Math.round(((step + 1) / total) * 100)

  const stepContent = () => {
    if (curStep.type === 'yesno') {
      return (
        <div style={{ display: 'flex', gap: 5 }}>
          {(['Yes', 'No'] as const).map(opt => {
            const active = fields.displacement === opt
            const col = opt === 'Yes' ? '#4ade80' : '#f87171'
            return (
              <button key={opt} onClick={() => onChange('displacement', active ? '' : opt)} style={{
                padding: '6px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${active ? col + '44' : '#1e1e1e'}`,
                background: active ? `${col}14` : 'transparent',
                color: active ? col : '#666',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>{opt}</button>
            )
          })}
        </div>
      )
    }
    if (curStep.type === 'stdv') {
      const arr = fields.stdvPresent
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Timeframe</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {TIMEFRAMES.map(tf => {
                const tag = `STDV (${tf})`
                const sel = arr.includes(tag)
                return (
                  <button key={tf} onClick={() => toggleTag('stdvPresent', arr, tag)} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                    background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
                    color: sel ? '#4ade80' : '#666',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}>{tf}</button>
                )
              })}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Level</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {STDV_CONTEXT_LEVELS.map(lv => {
                const tag = `STDV ${lv}`
                const sel = arr.includes(tag)
                return (
                  <button key={lv} onClick={() => toggleTag('stdvPresent', arr, tag)} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
                    background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
                    color: sel ? '#4ade80' : '#666',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}>{lv}</button>
                )
              })}
            </div>
          </div>
        </div>
      )
    }
    // tf type
    const base = curStep.bases![0]
    const arr = (fields[curStep.key] as string[]) || []
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {TIMEFRAMES.map(tf => {
          const tag = `${base} (${tf})`
          const sel = arr.includes(tag)
          return (
            <button key={tf} onClick={() => toggleTag(curStep.key, arr, tag)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              border: `1px solid ${sel ? 'rgba(74,222,128,0.4)' : '#1a1a1a'}`,
              background: sel ? 'rgba(74,222,128,0.1)' : 'transparent',
              color: sel ? '#4ade80' : '#666',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}>{tf}</button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#d0d0d0' }}>{curStep.label}</span>
        <span style={{ fontSize: 11, color: '#444', fontWeight: 600 }}>{step + 1} / {total}</span>
      </div>
      <div style={{ height: 2, background: '#1a1a1a', borderRadius: 999, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#4ade80', borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ marginBottom: 12 }}>{stepContent()}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => { if (step === 0) setStep(null); else setStep(s => (s ?? 1) - 1) }}
          style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #1e1e1e', background: 'transparent', color: '#555', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#2a2a2a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#1e1e1e' }}
        >{step === 0 ? '✕ Close' : '← Back'}</button>
        <div style={{ flex: 1 }} />
        {step < total - 1 ? (
          <>
            <button onClick={() => setStep(s => (s ?? 0) + 1)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #1e1e1e', background: 'transparent', color: '#555', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#aaa' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555' }}
            >Skip</button>
            <button onClick={() => setStep(s => (s ?? 0) + 1)} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', background: '#f0f0f0', color: '#111', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f0f0f0' }}
            >Next →</button>
          </>
        ) : (
          <button onClick={() => setStep(null)} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            Done ✓
          </button>
        )}
      </div>
      {allChips.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #141414' }}>
          <div style={{ fontSize: 10, color: '#3a3a3a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Selected</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allChips.map((chip, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px 2px 8px', borderRadius: 999, fontSize: 11, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc' }}>
                {chip.label}
                <button onClick={chip.remove} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#555', display: 'flex', lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                ><X size={8} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── New Trade Modal ───────────────────────────────────────────────────────────

function NewTradeModal({ initialDate, onSave, onClose, tradingAccounts }: {
  initialDate: string
  onSave: (trade: TradeLog, date: string) => void
  onClose: () => void
  tradingAccounts: TradingAccount[]
}) {
  const [trade, setTrade] = useState<TradeLog>(() => emptyTrade())
  const [date, setDate] = useState(initialDate)
  const [saved, setSaved] = useState(false)
  const [openSec, setOpenSec] = useState([true, true, true])
  const [screenshots, setScreenshots] = useState<string[]>([''])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleSec = (i: number) => setOpenSec(prev => prev.map((v, j) => j === i ? !v : v))

  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => {
    setTrade(prev => {
      const next = { ...prev, [k]: v }
      if (['symbol', 'side', 'entryPrice', 'exitPrice', 'contracts'].includes(k as string))
        next.pnl = calcTradePnl(next.symbol, next.side, next.entryPrice, next.exitPrice, next.contracts)
      return next
    })
  }

  const toggleArr = (k: keyof TradeLog, val: string) => {
    const arr = (trade[k] as string[]) || []
    set(k, (arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]) as TradeLog[typeof k])
  }

  // Auto-calculated P&L
  const grossPnl = parseFloat(trade.pnl) || 0
  const feesVal = parseFloat(trade.fees || '0') || 0
  const netPnl = grossPnl - feesVal
  const hasPnl = trade.pnl !== ''
  const pv = PVMAP[trade.symbol] ?? 0
  const slPts = parseFloat(trade.stopLoss)
  const c = parseFloat(trade.contracts)
  const riskDollars = pv && !isNaN(slPts) && !isNaN(c) && c > 0 && slPts > 0 ? slPts * pv * c : 0
  const rMultiple = riskDollars > 0 && hasPnl ? parseFloat((grossPnl / riskDollars).toFixed(2)) : null

  const grossColor = grossPnl > 0 ? '#4ade80' : grossPnl < 0 ? '#f87171' : '#555'
  const netColor = netPnl > 0 ? '#4ade80' : netPnl < 0 ? '#f87171' : '#555'
  const rColor = rMultiple === null ? '#555' : rMultiple >= 1 ? '#4ade80' : '#f87171'

  // Auto-grade
  const autoGradeResult = calcSetupGrade(trade)
  const autoGradeColor = autoGradeResult ? (GRADE_COLORS[autoGradeResult.grade] || '#888') : '#252525'

  function handleSave() {
    const finalTrade = {
      ...trade,
      grade: autoGradeResult?.grade || '',
      screenshots: screenshots.filter(s => s !== ''),
    }
    onSave(finalTrade, date)
    setSaved(true)
    setTimeout(() => onClose(), 700)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ background: '#090909', border: '1px solid #1a1a1a', borderRadius: 16, width: '100%', maxWidth: 920, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #141414' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f8f8f8', flex: 1 }}>New Trade</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a2a2a', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#888')}
            onMouseLeave={e => (e.currentTarget.style.color = '#2a2a2a')}
          ><X size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 24px' }}>

          {/* ── SECTION 1: BASIC TRADE DETAILS ── */}
          <SectionHeader title="Basic Trade Details" open={openSec[0]} onToggle={() => toggleSec(0)} />
          {openSec[0] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 20, paddingBottom: 8 }}>

              {/* Row 1: Date · Time · Symbol · Account */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 110px 120px 1fr', gap: 14 }}>
                <div>
                  {fieldLabel('Date')}
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
                <div>
                  {fieldLabel('Time')}
                  <input type="time" value={trade.time || ''} onChange={e => set('time', e.target.value)}
                    style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
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
                  {fieldLabel('Account')}
                  {(() => {
                    const labels = tradingAccounts.length > 0
                      ? tradingAccounts.map(a => a.name)
                      : ['Live', 'Funded', 'Eval']
                    return (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {labels.map(label => {
                          const active = (trade.accounts || []).includes(label)
                          return (
                            <button key={label} onClick={() => toggleArr('accounts', label)} style={{
                              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                              border: `1px solid ${active ? '#4a4a4a' : '#1a1a1a'}`,
                              background: active ? '#1e1e1e' : 'transparent',
                              color: active ? '#e0e0e0' : '#555',
                              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                            }}
                              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#aaa' }}
                              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#555' }}
                            >{label}</button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Row 2: Direction · Contracts · Fees · Duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                <div>
                  {fieldLabel('Direction')}
                  <div style={{ display: 'flex', gap: 5, height: 36 }}>
                    {(['Long', 'Short'] as const).map(side => {
                      const active = trade.side === side
                      const col = side === 'Long' ? '#22d3ee' : '#f87171'
                      return (
                        <button key={side} onClick={() => set('side', side)} style={{
                          flex: 1, borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${active ? col + '44' : '#1e1e1e'}`,
                          background: active ? `${col}14` : 'transparent',
                          color: active ? col : '#3a3a3a',
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
                  {fieldLabel('Fees ($)')}
                  <input type="number" value={trade.fees} onChange={e => set('fees', e.target.value)}
                    placeholder="0.00" min="0" step="0.01" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
                <div>
                  {fieldLabel('Duration')}
                  <input value={trade.duration} onChange={e => set('duration', e.target.value)}
                    placeholder="e.g. 45m, 2h" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
              </div>

              {/* Row 3: Entry · Exit · Target Price · Trade # */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                <div>
                  {fieldLabel('Entry Price')}
                  <input type="number" value={trade.entryPrice} onChange={e => set('entryPrice', e.target.value)}
                    placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
                <div>
                  {fieldLabel('Exit Price')}
                  <input type="number" value={trade.exitPrice} onChange={e => set('exitPrice', e.target.value)}
                    placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
                <div>
                  {fieldLabel('Target Price')}
                  <input type="number" value={trade.targetPrice} onChange={e => set('targetPrice', e.target.value)}
                    placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
                <div>
                  {fieldLabel('Trade # (today)')}
                  <input type="number" value={trade.tradeNumber} onChange={e => set('tradeNumber', e.target.value)}
                    placeholder="1" min="1" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
              </div>

              {/* Row 4: TP · SL · Drawdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  {fieldLabel('Take Profit (pts)')}
                  <input type="number" value={trade.takeProfit} onChange={e => set('takeProfit', e.target.value)}
                    placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
                <div>
                  {fieldLabel('Stop Loss (pts)')}
                  <input type="number" value={trade.stopLoss} onChange={e => set('stopLoss', e.target.value)}
                    placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
                <div>
                  {fieldLabel('Drawdown (pts)')}
                  <input type="number" value={trade.drawdown} onChange={e => set('drawdown', e.target.value)}
                    placeholder="0" min="0" step="0.25" style={inputBase} onFocus={e => (e.target.style.borderColor = '#333')} onBlur={e => (e.target.style.borderColor = '#1e1e1e')} />
                </div>
              </div>

              {/* Row 5: Result */}
              <div>
                {fieldLabel('Result')}
                <div style={{ display: 'flex', gap: 5 }}>
                  {RESULTS.map(r => (
                    <PillBtn key={r.value} label={r.label} active={trade.result === r.value}
                      onClick={() => set('result', r.value)} activeColor={r.color} activeBg={r.bg} />
                  ))}
                </div>
              </div>

              {/* Row 6: Session */}
              <div>
                {fieldLabel('Session')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {SESSION_OPTIONS.map(s => (
                    <TagChip key={s.value} label={s.label} active={(trade.sessions || []).includes(s.value)} onClick={() => toggleArr('sessions', s.value)} />
                  ))}
                </div>
              </div>

              {/* Auto-Calculated subsection */}
              <div style={{ background: '#0b0b0b', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px', marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Auto-Calculated</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, borderLeft: '1px solid #1a1a1a' }}>
                  {[
                    { label: 'Gross P&L', value: hasPnl ? (grossPnl >= 0 ? '+' : '') + formatCurrency(grossPnl) : '—', color: hasPnl ? grossColor : '#333' },
                    { label: 'Net P&L',   value: hasPnl ? (netPnl >= 0 ? '+' : '') + formatCurrency(netPnl) : '—',   color: hasPnl ? netColor : '#333' },
                    { label: 'R Multiple', value: rMultiple !== null ? `${rMultiple >= 0 ? '+' : ''}${rMultiple}R` : '—', color: rMultiple !== null ? rColor : '#333' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '0 20px', borderRight: '1px solid #1a1a1a' }}>
                      <div style={{ fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{item.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: item.color, letterSpacing: '-0.02em' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── SECTION 2: TRADE CONTEXT ── */}
          <SectionHeader title="Trade Context" open={openSec[1]} onToggle={() => toggleSec(1)} />
          {openSec[1] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 20, paddingBottom: 8 }}>

              {/* HTF Bias + Market Condition */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  {fieldLabel('HTF Bias')}
                  <div style={{ display: 'flex', gap: 5, height: 36 }}>
                    {(['Long', 'Short'] as const).map(side => {
                      const active = trade.htfBias === side
                      const col = side === 'Long' ? '#22d3ee' : '#f87171'
                      return (
                        <button key={side} onClick={() => set('htfBias', active ? '' : side)} style={{
                          flex: 1, borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${active ? col + '44' : '#1e1e1e'}`,
                          background: active ? `${col}14` : 'transparent',
                          color: active ? col : '#3a3a3a',
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
                  {fieldLabel('Market Condition')}
                  <div style={{ display: 'flex', gap: 5, height: 36 }}>
                    {(['Consolidation', 'Distribution'] as const).map(mc => {
                      const active = trade.marketCondition === mc
                      return (
                        <button key={mc} onClick={() => set('marketCondition', active ? '' : mc)} style={{
                          flex: 1, borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${active ? '#4a4a4a' : '#1e1e1e'}`,
                          background: active ? '#1e1e1e' : 'transparent',
                          color: active ? '#e0e0e0' : '#3a3a3a',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
                        >{mc}</button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Draw on Liquidity */}
              <div>
                {fieldLabel('Draw on Liquidity')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {MODAL_DOL_OPTIONS.map(d => (
                    <TagChip key={d} label={d} active={(trade.dol || []).includes(d)} onClick={() => toggleArr('dol', d)} />
                  ))}
                </div>
              </div>

              {/* Internal Range Liquidity */}
              <div>
                {fieldLabel('Internal Range Liquidity')}
                <TFTagPicker bases={['FVG']} selected={trade.internalRangeLiquidity || []} onChange={v => set('internalRangeLiquidity', v)} />
              </div>

              {/* External Range Liquidity */}
              <div>
                {fieldLabel('External Range Liquidity')}
                <TFTagPicker bases={['Swing High', 'Swing Low']} selected={trade.externalRangeLiquidity || []} onChange={v => set('externalRangeLiquidity', v)} />
              </div>

              {/* Liquidity Swept */}
              <div>
                {fieldLabel('Liquidity Swept')}
                <TFTagPicker bases={['Swing High', 'Swing Low']} selected={trade.liquiditySwept || []} onChange={v => set('liquiditySwept', v)} />
              </div>

              {/* ICT Context Wizard (SMT → STDV) */}
              <div>
                {fieldLabel('ICT Context')}
                <ICTWizard
                  fields={{
                    smtPresent:     trade.smtPresent     || [],
                    cisdPresent:    trade.cisdPresent    || [],
                    displacement:   trade.displacement   || '',
                    fvgPresent:     trade.fvgPresent     || [],
                    ifvgPresent:    trade.ifvgPresent    || [],
                    rejectionBlock: trade.rejectionBlock || [],
                    orderBlock:     trade.orderBlock     || [],
                    bprPresent:     trade.bprPresent     || [],
                    otePresent:     trade.otePresent     || [],
                    stdvPresent:    trade.stdvPresent    || [],
                  }}
                  onChange={(k, v) => setTrade(prev => ({ ...prev, [k]: v }))}
                />
              </div>

              {/* Timeframe Executed + Exit Reason */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  {fieldLabel('Timeframe Executed On')}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {TIMEFRAMES.map(tf => {
                      const active = trade.timeframeExecuted === tf
                      return (
                        <button key={tf} onClick={() => set('timeframeExecuted', active ? '' : tf)} style={{
                          padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                          border: `1px solid ${active ? 'rgba(74,222,128,0.4)' : '#222'}`,
                          background: active ? 'rgba(74,222,128,0.1)' : 'transparent',
                          color: active ? '#4ade80' : '#666',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                          onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.borderColor = '#333' } }}
                          onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#222' } }}
                        >{tf}</button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  {fieldLabel('Exit Reason')}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {EXIT_REASONS.map(r => {
                      const active = (trade.exitReason || []).includes(r)
                      return (
                        <button key={r} onClick={() => toggleArr('exitReason', r)} style={{
                          padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                          border: `1px solid ${active ? '#4a4a4a' : '#222'}`,
                          background: active ? '#252525' : 'transparent',
                          color: active ? '#f0f0f0' : '#666',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                          onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.borderColor = '#333' } }}
                          onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#222' } }}
                        >{r}</button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* News Present */}
              <div>
                {fieldLabel('News Present')}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(['Yes', 'No'] as const).map(opt => {
                      const active = trade.newsPresent === opt
                      const col = opt === 'Yes' ? '#fbbf24' : '#888'
                      return (
                        <button key={opt} onClick={() => set('newsPresent', active ? '' : opt)} style={{
                          padding: '6px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${active ? col + '44' : '#1e1e1e'}`,
                          background: active ? `${col}14` : 'transparent',
                          color: active ? col : '#3a3a3a',
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#666' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#3a3a3a' }}
                        >{opt}</button>
                      )
                    })}
                  </div>
                  {trade.newsPresent === 'Yes' && (
                    <input
                      value={trade.newsType || ''}
                      onChange={e => set('newsType', e.target.value)}
                      placeholder="News event / type…"
                      style={{ ...inputBase, flex: 1, minWidth: 160 }}
                      onFocus={e => (e.target.style.borderColor = '#333')}
                      onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                    />
                  )}
                </div>
              </div>

              {/* Auto-Grade subsection */}
              <div style={{ background: '#0b0b0b', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Setup Grade — Auto Calculated</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ fontSize: 48, fontWeight: 800, color: autoGradeColor, letterSpacing: '-0.03em', lineHeight: 1, minWidth: 60 }}>
                    {autoGradeResult?.grade ?? '—'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 14, color: '#888', fontWeight: 500 }}>
                      {autoGradeResult
                        ? `${autoGradeResult.score} signal${autoGradeResult.score !== 1 ? 's' : ''} detected`
                        : 'Fill in trade context fields to generate a grade'}
                    </div>
                    <div style={{ fontSize: 12, color: '#555' }}>
                      HTF bias · DOL · Liquidity · PD Arrays · Structure · Execution
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {GRADES.map(g => (
                      <div key={g} style={{
                        width: 32, height: 32, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        background: autoGradeResult?.grade === g ? `${GRADE_COLORS[g]}20` : 'transparent',
                        border: `1px solid ${autoGradeResult?.grade === g ? GRADE_COLORS[g] + '55' : '#1a1a1a'}`,
                        color: autoGradeResult?.grade === g ? GRADE_COLORS[g] : '#444',
                        transition: 'all 0.2s',
                      }}>{g}</div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── SECTION 3: SCREENSHOTS & NOTES ── */}
          <SectionHeader title="Screenshots & Notes" open={openSec[2]} onToggle={() => toggleSec(2)} />
          {openSec[2] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 20, paddingBottom: 8 }}>

              {/* Dynamic screenshots */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {screenshots.map((src, idx) => (
                  <ScreenshotUpload
                    key={idx}
                    label={screenshots.length > 1 ? `Screenshot ${idx + 1}` : 'Screenshot'}
                    preview={src || null}
                    onFile={url => setScreenshots(prev => prev.map((s, i) => i === idx ? url : s))}
                    onClear={() => {
                      if (screenshots.length === 1) {
                        setScreenshots([''])
                      } else {
                        setScreenshots(prev => prev.filter((_, i) => i !== idx))
                      }
                    }}
                  />
                ))}
                <button
                  onClick={() => setScreenshots(prev => [...prev, ''])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                    background: 'transparent', border: '1px dashed #1e1e1e', borderRadius: 8,
                    color: '#3a3a3a', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s', fontFamily: 'inherit', alignSelf: 'flex-start',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#333' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = '#1e1e1e' }}
                ><Plus size={12} /> Add Screenshot</button>
              </div>

              {/* Notes */}
              <div>
                {fieldLabel('Notes')}
                <textarea
                  value={trade.notes || ''}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Post-trade reflections, what went well, what to improve…"
                  rows={4}
                  style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={e => (e.target.style.borderColor = '#333')}
                  onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
                />
              </div>

            </div>
          )}

          <div style={{ height: 8 }} />
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 24px', borderTop: '1px solid #141414', background: '#080808' }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #1e1e1e', background: 'transparent', color: '#555', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = '#333' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#1e1e1e' }}
          >Cancel</button>
          <button onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 22px', borderRadius: 8, border: 'none', background: saved ? 'rgba(74,222,128,0.15)' : '#f0f0f0', color: saved ? '#4ade80' : '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', outline: saved ? '1px solid rgba(74,222,128,0.3)' : 'none' }}
            onMouseEnter={e => { if (!saved) e.currentTarget.style.background = '#fff' }}
            onMouseLeave={e => { if (!saved) e.currentTarget.style.background = saved ? 'rgba(74,222,128,0.15)' : '#f0f0f0' }}
          ><Save size={13} />{saved ? 'Saved!' : 'Save Trade'}</button>
        </div>

      </div>
    </div>
  )
}

// ── Inline Trade Form (for editing existing trades) ───────────────────────────

interface FormProps {
  trade: TradeLog
  date: string
  saved: boolean
  onUpdate: (t: TradeLog) => void
  onDateChange: (d: string) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  tradingAccounts: TradingAccount[]
}

function InlineTradeForm({ trade, date, saved, onUpdate, onDateChange, onSave, onDelete, onClose, tradingAccounts }: FormProps) {
  const [htfPreview, setHtfPreview] = useState<string | null>(trade.htfImgKey?.startsWith('data:') ? trade.htfImgKey : null)
  const [execPreview, setExecPreview] = useState<string | null>(trade.execImgKey?.startsWith('data:') ? trade.execImgKey : null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => {
    const next = { ...trade, [k]: v }
    if (['symbol', 'side', 'entryPrice', 'exitPrice', 'contracts'].includes(k as string))
      next.pnl = calcTradePnl(next.symbol, next.side, next.entryPrice, next.exitPrice, next.contracts)
    onUpdate(next)
  }

  const toggleAccount = (a: string) => {
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

  const pnlVal = parseFloat(trade.pnl)
  const hasPnl = trade.pnl !== ''
  const pnlColor = pnlVal > 0 ? '#4ade80' : pnlVal < 0 ? '#f87171' : '#888'
  const rrVal = calcRR(trade.takeProfit, trade.stopLoss)
  const rrColor = !rrVal ? '#2a2a2a' : parseFloat(rrVal) >= 1 ? '#4ade80' : '#f87171'
  const showDrawdown = trade.result === 'Win' || trade.result === 'BE' || trade.result === 'Faded'

  return (
    <div style={{ borderTop: '1px solid #111', background: '#080808', padding: '26px 36px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── Top controls row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 5, flex: '0 0 auto' }}>
            {RESULTS.map(r => (
              <PillBtn key={r.value} label={r.label} active={trade.result === r.value}
                onClick={() => set('result', r.value)} activeColor={r.color} activeBg={r.bg} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flex: '0 0 auto' }}>
            {GRADES.map(g => {
              const col = GRADE_COLORS[g]
              return (
                <PillBtn key={g} label={g} active={trade.grade === g}
                  onClick={() => set('grade', trade.grade === g ? '' : g)} activeColor={col} activeBg={`${col}18`} />
              )
            })}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '6px 10px', borderRadius: 7, border: `1px solid ${confirmDelete ? 'rgba(239,68,68,0.4)' : '#1e1e1e'}`, background: confirmDelete ? 'rgba(239,68,68,0.1)' : 'transparent', color: confirmDelete ? '#f87171' : '#444', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!confirmDelete) { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' } }}
            onMouseLeave={e => { if (!confirmDelete) { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1e1e1e' } }}
          ><Trash2 size={11} />{confirmDelete ? 'Confirm?' : 'Delete'}</button>
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
            {(() => {
              const labels = tradingAccounts.length > 0
                ? tradingAccounts.map(a => a.name)
                : ['Live', 'Funded', 'Eval']
              return (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {labels.map(label => {
                    const active = (trade.accounts || []).includes(label)
                    return (
                      <button key={label} onClick={() => toggleAccount(label)} style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                        border: `1px solid ${active ? '#4a4a4a' : '#1a1a1a'}`,
                        background: active ? '#1e1e1e' : 'transparent',
                        color: active ? '#e0e0e0' : '#555',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#aaa' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#555' }}
                      >{label}</button>
                    )
                  })}
                </div>
              )
            })()}
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
                const col = side === 'Long' ? '#22d3ee' : '#f87171'
                return (
                  <button key={side} onClick={() => set('side', side)} style={{
                    flex: 1, borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? col + '44' : '#1e1e1e'}`,
                    background: active ? `${col}14` : 'transparent',
                    color: active ? col : '#3a3a3a',
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fieldLabel('Calc P&L')}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a', padding: '0 10px' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: hasPnl ? pnlColor : '#2a2a2a' }}>
                {hasPnl ? (pnlVal >= 0 ? '+' : '') + formatCurrency(pnlVal) : '—'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fieldLabel('R:R')}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a', padding: '0 10px' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: rrColor }}>
                {rrVal ? `${parseFloat(rrVal) >= 0 ? '+' : ''}${rrVal}R` : '—'}
              </span>
            </div>
          </div>
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
          <div>
            {fieldLabel('Session')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SESSION_OPTIONS.map(s => (
                <TagChip key={s.value} label={s.label} active={(trade.sessions || []).includes(s.value)} onClick={() => toggleSession(s.value)} />
              ))}
            </div>
          </div>
          <div>
            {fieldLabel('Confluences')}
            <ConfluenceWizard confluences={trade.confluences} onChange={v => set('confluences', v)} />
          </div>
          <div>
            {fieldLabel('Draw on Liquidity')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {DOL_OPTIONS.map(d => (
                <TagChip key={d} label={d} active={(trade.dol || []).includes(d)} onClick={() => toggleDol(d)} />
              ))}
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
      <span style={{ fontSize: 12, color: expanded ? '#888' : '#666', fontWeight: 500 }}>{dateLabel}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: expanded ? '#f0f0f0' : '#d0d0d0' }}>{trade.symbol || '—'}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, width: 'fit-content',
        background: trade.side === 'Long' ? 'rgba(34,211,238,0.12)' : 'rgba(248,113,113,0.1)',
        border: `1px solid ${trade.side === 'Long' ? 'rgba(34,211,238,0.25)' : 'rgba(248,113,113,0.2)'}`,
        color: trade.side === 'Long' ? '#22d3ee' : '#f87171',
      }}>{trade.side}</span>
      <span style={{ fontSize: 13, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10 }}>{setupLabel}</span>
      <span style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sessionLabel}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: pnlColor }}>
        {trade.pnl ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '—'}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: rrColor }}>
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
          padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, width: 'fit-content',
          background: `${gc}18`, border: `1px solid ${gc}44`, color: gc,
        }}>{trade.grade}</span>
      ) : (
        <span style={{ fontSize: 12, color: '#333' }}>—</span>
      )}
      <ChevronDown size={14} color="#555" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s', justifySelf: 'end' }} />
    </div>
  )
}

// ── Main Journal ──────────────────────────────────────────────────────────────

interface JournalProps {
  entries: JournalEntry[]
  confluenceTags: string[]
  tradingRules: TradingRule[]
  tradingAccounts: TradingAccount[]
  onSave: (entry: JournalEntry) => void
  onDelete: (date: string) => void
  onAddConfluenceTag: (tag: string) => void
  onDeleteConfluenceTag: (tag: string) => void
  onAddTradingRule: (text: string) => void
  onRemoveTradingRule: (id: string) => void
  onUpdateTradingRule: (id: string, text: string) => void
  initialDate?: string
}

export function Journal({ entries, onSave, onDelete, initialDate, tradingAccounts }: JournalProps) {
  const [search, setSearch] = useState('')
  const [filterResult, setFilterResult] = useState('All')
  const [filterSession, setFilterSession] = useState('All')
  const [filterPnl, setFilterPnl] = useState('All')

  const [showNewModal, setShowNewModal] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState(todayStr())

  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [buffer, setBuffer] = useState<TradeLog | null>(null)
  const [bufferDate, setBufferDate] = useState(todayStr())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (initialDate) openNew(initialDate)
  }, [initialDate]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setModalInitialDate(date || todayStr())
    setShowNewModal(true)
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
  }

  function closeExpanded() {
    setExpandedKey(null); setBuffer(null)
  }

  function handleModalSave(newTrade: TradeLog, date: string) {
    const existingEntry = entries.find(e => e.date === date)
    const entry = safeEntry(existingEntry, date)
    entry.trades = [...entry.trades, newTrade]
    entry.updatedAt = new Date().toISOString()
    onSave(entry)
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
    setExpandedKey(null); setBuffer(null)
  }

  const filtersActive = search || filterResult !== 'All' || filterSession !== 'All' || filterPnl !== 'All'
  const COL = '150px 70px 84px 1fr 130px 110px 70px 76px 56px 24px'

  const hStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#555',
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

      {showNewModal && (
        <NewTradeModal
          initialDate={modalInitialDate}
          onSave={handleModalSave}
          onClose={() => setShowNewModal(false)}
          tradingAccounts={tradingAccounts}
        />
      )}

      {/* Filter bar */}
      <div style={{ flexShrink: 0, padding: '12px 36px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: 10, background: '#070707' }}>
        <span style={{ fontSize: 13, color: '#666', marginRight: 4, whiteSpace: 'nowrap' }}>Log, scan and review every trade.</span>
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
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 0', gap: 12 }}>
            <BookOpen size={30} color="#333" />
            <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
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
                <div style={{ display: 'grid', gridTemplateRows: isExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
                  <div style={{ overflow: 'hidden' }}>
                    {isExpanded && buffer && (
                      <InlineTradeForm
                        trade={buffer}
                        date={bufferDate}
                        saved={saved}
                        onUpdate={t => setBuffer(t)}
                        onDateChange={d => setBufferDate(d)}
                        onSave={handleSave}
                        onDelete={handleDelete}
                        onClose={closeExpanded}
                        tradingAccounts={tradingAccounts}
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
