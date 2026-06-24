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
    propFirm: '',
    copyTraded: '',
    aplusSetup: '',
    targetLogic: '',
    paybackUsed: '',
    riskPlacementLogic: '',
    ipvdPresent: '',
    newsImpact: '',
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

const RESULTS: { value: TradeResult; label: string; color: string; bg: string }[] = [
  { value: 'Win',   label: 'Win',   color: 'var(--color-win)',  bg: 'var(--color-win-bg)'  },
  { value: 'Loss',  label: 'Loss',  color: 'var(--color-loss)', bg: 'var(--color-loss-bg)' },
  { value: 'BE',    label: 'BE',    color: '#aaaaaa', bg: 'rgba(170,170,170,0.12)' },
  { value: "Didn't take", label: "Didn't take", color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
]
const RESULT_COLORS: Record<string, string> = { Win: 'var(--color-win)', Loss: 'var(--color-loss)', BE: '#aaaaaa', "Didn't take": '#fb923c' }

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F']
const GRADE_COLORS: Record<string, string> = { 'A+': '#22c55e', A: '#4ade80', B: '#fbbf24', C: '#fb923c', D: '#ef4444', F: '#ef4444' }

const SESSION_OPTIONS = [
  { value: 'Asia Session', label: 'Asia Session' },
  { value: 'London Session', label: 'London Session' },
  { value: 'Pre-market', label: 'Pre-market' },
  { value: 'New York AM Session', label: 'New York AM Session' },
  { value: 'Pre-market Asia Session', label: 'Pre-market Asia Session' },
]
const DOL_STORAGE_KEY = 'journal_custom_dols'
const EXIT_REASON_STORAGE_KEY = 'journal_custom_exit_reasons'

function loadCustomDols(): string[] {
  try { return JSON.parse(localStorage.getItem(DOL_STORAGE_KEY) || '[]') } catch { return [] }
}
function saveCustomDols(dols: string[]) {
  localStorage.setItem(DOL_STORAGE_KEY, JSON.stringify(dols))
}
function loadCustomExitReasons(): string[] {
  try { return JSON.parse(localStorage.getItem(EXIT_REASON_STORAGE_KEY) || '[]') } catch { return [] }
}
function saveCustomExitReasons(reasons: string[]) {
  localStorage.setItem(EXIT_REASON_STORAGE_KEY, JSON.stringify(reasons))
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-mid)', borderRadius: 8,
  padding: '10px 13px', fontSize: 18, color: 'var(--text)', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit', minHeight: '46px',
}
const fieldLabel = (text: string) => (
  <div style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{text}</div>
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
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-mid)' }}>
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
          style={{ border: '2px dashed var(--border-mid)', borderRadius: 8, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
        >
          <ImageIcon size={16} color="var(--text-muted)" />
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Click or drag image</span>
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
      flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 15, fontWeight: 600,
      border: `1px solid ${active ? activeColor + '55' : 'var(--border-mid)'}`,
      background: active ? activeBg : 'transparent',
      color: active ? activeColor : 'var(--text-muted)',
      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-sub)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
    >{label}</button>
  )
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 999, fontSize: 14, fontWeight: 500,
      border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-mid)'}`,
      background: active ? 'var(--bg-active)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-muted)',
      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-strong)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' } }}
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
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 14, background: 'var(--bg-active)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
                {tag}
                <button onClick={() => toggle(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                ><X size={9} /></button>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => setStep(0)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 8, border: '1px dashed var(--border-mid)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
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
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      {/* Step header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-label)' }}>{current}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{step + 1} / {total}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--border)', borderRadius: 999, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#22c55e', borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>

      {/* Timeframe options */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {TIMEFRAMES.map(tf => {
          const combo = `${current} (${tf})`
          const sel = confluences.includes(combo)
          return (
            <button key={tf} onClick={() => toggle(combo)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 14, fontWeight: 500,
              border: `1px solid ${sel ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
              background: sel ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: sel ? '#22c55e' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}>{tf}</button>
          )
        })}
        {current === 'STDV' && STDV_LEVELS.map(lv => {
          const tag = `STDV ${lv}σ`
          const sel = confluences.includes(tag)
          return (
            <button key={lv} onClick={() => toggle(tag)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 14, fontWeight: 500,
              border: `1px solid ${sel ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
              background: sel ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: sel ? '#22c55e' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}>{lv}σ</button>
          )
        })}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => { if (step === 0) setStep(null); else setStep(s => (s ?? 1) - 1) }}
          style={{ padding: '5px 11px', borderRadius: 7, fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >{step === 0 ? '✕ Close' : '← Back'}</button>
        <div style={{ flex: 1 }} />
        {step < total - 1 ? (
          <>
            <button onClick={() => setStep(s => (s ?? 0) + 1)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-sub)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >Skip</button>
            <button onClick={() => setStep(s => (s ?? 0) + 1)} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 14, fontWeight: 600, border: 'none', background: 'var(--btn-bg)', color: 'var(--btn-text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--btn-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--btn-bg)' }}
            >Next →</button>
          </>
        ) : (
          <button onClick={() => setStep(null)} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 14, fontWeight: 600, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            Done ✓
          </button>
        )}
      </div>

      {/* Selected summary at bottom */}
      {confluences.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Selected</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {confluences.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px 2px 8px', borderRadius: 999, fontSize: 13, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-label)' }}>
                {tag}
                <button onClick={() => toggle(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
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
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 14, background: 'var(--bg-active)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
              {tag}
              <button onClick={() => toggle(tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
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
              padding: '5px 12px', borderRadius: 999, fontSize: 14, fontWeight: 500,
              border: `1px solid ${hasAny || isOpen ? 'var(--border-strong)' : 'var(--border)'}`,
              background: hasAny || isOpen ? 'var(--bg-active)' : 'transparent',
              color: hasAny || isOpen ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}
              onMouseEnter={e => { if (!hasAny && !isOpen) { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-mid)' } }}
              onMouseLeave={e => { if (!hasAny && !isOpen) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
            >{base}</button>
          )
        })}
      </div>
      {activePicker && (
        <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Timeframe</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {TIMEFRAMES.map(tf => {
              const combo = `${activePicker} (${tf})`
              const sel = selected.includes(combo)
              return (
                <button key={tf} onClick={() => toggle(combo)} style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 14, fontWeight: 500,
                  border: `1px solid ${sel ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                  background: sel ? 'rgba(34,197,94,0.1)' : 'transparent',
                  color: sel ? '#22c55e' : 'var(--text-muted)',
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
  const [activeTab, setActiveTab] = useState(0)
  const [screenshots, setScreenshots] = useState<string[]>([''])
  const [customDols, setCustomDols] = useState<string[]>(() => loadCustomDols())
  const [newDolInput, setNewDolInput] = useState('')
  const [customExitReasons, setCustomExitReasons] = useState<string[]>(() => loadCustomExitReasons())
  const [newExitReasonInput, setNewExitReasonInput] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

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

  const addDol = (raw: string) => {
    const val = raw.trim()
    if (!val) return
    const updated = customDols.includes(val) ? customDols : [...customDols, val]
    setCustomDols(updated)
    saveCustomDols(updated)
    const cur = trade.dol || []
    if (!cur.includes(val)) set('dol', [...cur, val])
    setNewDolInput('')
  }

  const removeDolFromLibrary = (val: string) => {
    const updated = customDols.filter(d => d !== val)
    setCustomDols(updated)
    saveCustomDols(updated)
  }

  const addExitReason = (raw: string) => {
    const val = raw.trim()
    if (!val) return
    const updated = customExitReasons.includes(val) ? customExitReasons : [...customExitReasons, val]
    setCustomExitReasons(updated)
    saveCustomExitReasons(updated)
    const cur = trade.exitReason || []
    if (!cur.includes(val)) set('exitReason', [...cur, val])
    setNewExitReasonInput('')
  }

  const removeExitReasonFromLibrary = (val: string) => {
    const updated = customExitReasons.filter(r => r !== val)
    setCustomExitReasons(updated)
    saveCustomExitReasons(updated)
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

  const grossColor = grossPnl > 0 ? 'var(--color-win)' : grossPnl < 0 ? 'var(--color-loss)' : 'var(--text-dim)'
  const netColor = netPnl > 0 ? 'var(--color-win)' : netPnl < 0 ? 'var(--color-loss)' : 'var(--text-dim)'
  const rColor = rMultiple === null ? 'var(--text-dim)' : rMultiple >= 0 ? 'var(--color-win)' : 'var(--color-loss)'

  // Auto-grade
  const autoGradeResult = calcSetupGrade(trade)

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

  const TABS = ['BASIC TRADE DETAILS', 'ICT / TRADE CONTEXT', 'SCREENSHOTS & NOTES']

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>New Trade</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {TABS.map((tab, i) => (
              <button key={i} onClick={() => setActiveTab(i)} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                border: `1px solid ${activeTab === i ? 'var(--border-mid)' : 'transparent'}`,
                background: activeTab === i ? 'var(--bg-active)' : 'transparent',
                color: activeTab === i ? 'var(--text)' : 'var(--text-dim)',
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
                onMouseEnter={e => { if (activeTab !== i) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
                onMouseLeave={e => { if (activeTab !== i) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)' }}
              >{tab}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => setActiveTab(t => Math.max(0, t - 1))}
              style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontFamily: 'inherit', lineHeight: 1 }}>&#8249;</button>
            <button onClick={() => setActiveTab(t => Math.min(2, t + 1))}
              style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontFamily: 'inherit', lineHeight: 1 }}>&#8250;</button>
          </div>
          <button onClick={onClose}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-label)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >Cancel</button>
          <button onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 16px', borderRadius: 7, border: 'none', background: saved ? 'rgba(34,197,94,0.15)' : '#f0f0f0', color: saved ? '#22c55e' : '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', outline: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', flexShrink: 0 }}
            onMouseEnter={e => { if (!saved) e.currentTarget.style.background = 'var(--btn-hover)' }}
            onMouseLeave={e => { if (!saved) e.currentTarget.style.background = saved ? 'rgba(34,197,94,0.15)' : '#f0f0f0' }}
          ><Save size={13} />{saved ? 'Saved!' : 'Add Trade'}</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-sub)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          ><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px' }}>

          {/* ── TAB 0: BASIC TRADE DETAILS ── */}
          {activeTab === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>

              {/* Row 1: Date | Time | Symbol | Account | Prop Firm */}
              <div>
                {fieldLabel('Date')}
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Time')}
                <input type="time" value={trade.time || ''} onChange={e => set('time', e.target.value)}
                  style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Symbol')}
                <select value={trade.symbol} onChange={e => set('symbol', e.target.value)}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="">—</option>
                  {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                {fieldLabel('Account')}
                <select
                  value={(trade.accounts || [])[0] || ''}
                  onChange={e => set('accounts', e.target.value ? [e.target.value] : [])}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="">—</option>
                  {(tradingAccounts.length > 0 ? tradingAccounts.map(a => a.name) : ['Live', 'Funded', 'Eval']).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Prop Firm')}
                <input value={trade.propFirm || ''} onChange={e => set('propFirm', e.target.value)}
                  placeholder="e.g. Apex" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>

              {/* Row 2: Copy Traded | Session | Direction | Entry Price | Exit Price */}
              <div>
                {fieldLabel('Copy Traded')}
                <select value={trade.copyTraded || ''} onChange={e => set('copyTraded', e.target.value)}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                {fieldLabel('Session')}
                <select
                  value={(trade.sessions || [])[0] || ''}
                  onChange={e => set('sessions', e.target.value ? [e.target.value] : [])}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="">—</option>
                  {SESSION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                {fieldLabel('Direction')}
                <select value={trade.side} onChange={e => set('side', e.target.value as 'Long' | 'Short')}
                  style={{ ...inputBase, cursor: 'pointer', color: trade.side === 'Long' ? '#22d3ee' : 'var(--color-loss)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="Long">Long</option>
                  <option value="Short">Short</option>
                </select>
              </div>
              <div>
                {fieldLabel('Entry Price')}
                <input type="number" value={trade.entryPrice} onChange={e => set('entryPrice', e.target.value)}
                  placeholder="0" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Exit Price')}
                <input type="number" value={trade.exitPrice} onChange={e => set('exitPrice', e.target.value)}
                  placeholder="0" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>

              {/* Row 3: Stop Loss (pts) | Take Profit (pts) | Contracts | Fees $ | Result */}
              <div>
                {fieldLabel('Stop Loss (pts)')}
                <input type="number" value={trade.stopLoss} onChange={e => set('stopLoss', e.target.value)}
                  placeholder="0" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Take Profit (pts)')}
                <input type="number" value={trade.takeProfit} onChange={e => set('takeProfit', e.target.value)}
                  placeholder="0" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Contracts')}
                <input type="number" value={trade.contracts} onChange={e => set('contracts', e.target.value)}
                  placeholder="1" min="0" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Fees $')}
                <input type="number" value={trade.fees} onChange={e => set('fees', e.target.value)}
                  placeholder="0.00" min="0" step="0.01" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Result')}
                <select value={trade.result} onChange={e => set('result', e.target.value as TradeResult)}
                  style={{ ...inputBase, cursor: 'pointer', color: RESULT_COLORS[trade.result] || 'var(--text)', fontWeight: 600 }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {/* Row 4: Net P&L | R Multiple | Gross P&L | Duration | Trade # for Day */}
              <div>
                {fieldLabel('Net P&L')}
                <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 18,
                  color: hasPnl ? netColor : 'var(--text-dim)',
                  background: hasPnl && netPnl !== 0 ? (netPnl > 0 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)') : 'var(--bg)',
                  border: `1px solid ${hasPnl && netPnl !== 0 ? (netPnl > 0 ? 'var(--color-win-border)' : 'var(--color-loss-border)') : 'var(--border)'}`,
                }}>
                  {hasPnl ? (netPnl >= 0 ? '+' : '') + formatCurrency(netPnl) : '—'}
                </div>
              </div>
              <div>
                {fieldLabel('R Multiple')}
                <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 18,
                  color: rMultiple !== null ? rColor : 'var(--text-dim)',
                  background: rMultiple !== null && rMultiple !== 0 ? (rMultiple > 0 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)') : 'var(--bg)',
                  border: `1px solid ${rMultiple !== null && rMultiple !== 0 ? (rMultiple > 0 ? 'var(--color-win-border)' : 'var(--color-loss-border)') : 'var(--border)'}`,
                }}>
                  {rMultiple !== null ? `${rMultiple >= 0 ? '+' : ''}${rMultiple}R` : '—'}
                </div>
              </div>
              <div>
                {fieldLabel('Gross P&L')}
                <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 18,
                  color: hasPnl ? grossColor : 'var(--text-dim)',
                  background: hasPnl && grossPnl !== 0 ? (grossPnl > 0 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)') : 'var(--bg)',
                  border: `1px solid ${hasPnl && grossPnl !== 0 ? (grossPnl > 0 ? 'var(--color-win-border)' : 'var(--color-loss-border)') : 'var(--border)'}`,
                }}>
                  {hasPnl ? (grossPnl >= 0 ? '+' : '') + formatCurrency(grossPnl) : '—'}
                </div>
              </div>
              <div>
                {fieldLabel('Duration')}
                <input value={trade.duration} onChange={e => set('duration', e.target.value)}
                  placeholder="e.g. 45m" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Trade # for Day')}
                <input type="number" value={trade.tradeNumber} onChange={e => set('tradeNumber', e.target.value)}
                  placeholder="1" min="1" style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>

              {/* Row 5: Grade */}
              <div>
                {fieldLabel('Grade')}
                <select
                  value={trade.grade || ''}
                  onChange={e => set('grade', e.target.value)}
                  style={{ ...inputBase, cursor: 'pointer', color: trade.grade ? (GRADE_COLORS[trade.grade] || 'var(--text)') : 'var(--text-muted)', fontWeight: 700 }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="">{autoGradeResult ? `Auto · ${autoGradeResult.grade}` : 'Auto'}</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div /><div /><div /><div />

            </div>
          )}

          {/* ── TAB 1: ICT / TRADE CONTEXT ── */}
          {activeTab === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, alignItems: 'start' }}>

              {/* Row 1: HTF Bias | SMT Present | Rejection Block | Market Condition | News Present */}
              <div>
                {fieldLabel('HTF Bias')}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Long', 'Short'] as const).map(side => {
                    const active = trade.htfBias === side
                    const col = side === 'Long' ? '#22d3ee' : '#ef4444'
                    return (
                      <button key={side} onClick={() => set('htfBias', active ? '' : side)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${active ? col + '44' : 'var(--border)'}`,
                        background: active ? `${col}14` : 'transparent',
                        color: active ? col : 'var(--text-dim)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                      >{side}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                {fieldLabel('SMT Present')}
                <TFTagPicker bases={['SMT']} selected={trade.smtPresent || []} onChange={v => set('smtPresent', v)} />
              </div>
              <div>
                {fieldLabel('Rejection Block')}
                <TFTagPicker bases={['RB']} selected={trade.rejectionBlock || []} onChange={v => set('rejectionBlock', v)} />
              </div>
              <div>
                {fieldLabel('Market Condition')}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Consolidation', 'Distribution'] as const).map(mc => {
                    const short = mc === 'Consolidation' ? 'Consol.' : 'Distrib.'
                    const active = trade.marketCondition === mc
                    return (
                      <button key={mc} onClick={() => set('marketCondition', active ? '' : mc)} style={{
                        flex: 1, padding: '8px 2px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                        background: active ? 'var(--bg-active)' : 'transparent',
                        color: active ? 'var(--text)' : 'var(--text-dim)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                      >{short}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                {fieldLabel('News Present')}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Yes', 'No'] as const).map(opt => {
                    const active = trade.newsPresent === opt
                    return (
                      <button key={opt} onClick={() => set('newsPresent', active ? '' : opt)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${active ? (opt === 'Yes' ? '#fbbf2444' : 'var(--border-strong)') : 'var(--border)'}`,
                        background: active ? (opt === 'Yes' ? '#fbbf2414' : 'var(--bg-active)') : 'transparent',
                        color: active ? (opt === 'Yes' ? '#fbbf24' : 'var(--text)') : 'var(--text-dim)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                      >{opt}</button>
                    )
                  })}
                </div>
              </div>

              {/* Row 2: Draw on Liquidity | OB Present | Entry Model | Exit Reason | A+ Setup */}
              <div>
                {fieldLabel('Draw on Liquidity')}
                {(customDols.length > 0 || (trade.dol || []).some(d => !customDols.includes(d))) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                    {customDols.map(d => {
                      const active = (trade.dol || []).includes(d)
                      return (
                        <div key={d} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, overflow: 'hidden', border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-mid)'}`, background: active ? 'var(--bg-active)' : 'transparent' }}>
                          <button onClick={() => toggleArr('dol', d)} style={{ padding: '5px 8px 5px 12px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', color: active ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s' }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-sub)' }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                          >{d}</button>
                          <button onClick={() => removeDolFromLibrary(d)} title="Remove from library" style={{ padding: '5px 7px 5px 2px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                          ><X size={9} /></button>
                        </div>
                      )
                    })}
                    {(trade.dol || []).filter(d => !customDols.includes(d)).map(d => (
                      <TagChip key={d} label={d} active={true} onClick={() => toggleArr('dol', d)} />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5 }}>
                  <input
                    value={newDolInput}
                    onChange={e => setNewDolInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDol(newDolInput) } }}
                    placeholder="Add DOL…"
                    style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
                  />
                  <button onClick={() => addDol(newDolInput)} style={{
                    padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600,
                    cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
                  >+</button>
                </div>
              </div>
              <div>
                {fieldLabel('OB Present')}
                <TFTagPicker bases={['OB']} selected={trade.orderBlock || []} onChange={v => set('orderBlock', v)} />
              </div>
              <div>
                {fieldLabel('Entry Model')}
                <input value={trade.entryModel || ''} onChange={e => set('entryModel', e.target.value)}
                  placeholder="Model name..." style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Exit Reason')}
                {(customExitReasons.length > 0 || (trade.exitReason || []).some(r => !customExitReasons.includes(r))) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                    {customExitReasons.map(r => {
                      const active = (trade.exitReason || []).includes(r)
                      return (
                        <div key={r} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, overflow: 'hidden', border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-mid)'}`, background: active ? 'var(--bg-active)' : 'transparent' }}>
                          <button onClick={() => toggleArr('exitReason', r)} style={{ padding: '5px 8px 5px 12px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: active ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s' }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-sub)' }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                          >{r}</button>
                          <button onClick={() => removeExitReasonFromLibrary(r)} title="Remove from library" style={{ padding: '5px 7px 5px 2px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                          ><X size={9} /></button>
                        </div>
                      )
                    })}
                    {(trade.exitReason || []).filter(r => !customExitReasons.includes(r)).map(r => (
                      <TagChip key={r} label={r} active={true} onClick={() => toggleArr('exitReason', r)} />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5 }}>
                  <input
                    value={newExitReasonInput}
                    onChange={e => setNewExitReasonInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExitReason(newExitReasonInput) } }}
                    placeholder="Add exit reason…"
                    style={{ ...inputBase, fontSize: 13, padding: '7px 10px' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
                  />
                  <button onClick={() => addExitReason(newExitReasonInput)} style={{
                    padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600,
                    cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
                  >+</button>
                </div>
              </div>
              <div>
                {fieldLabel('A+ Setup')}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Yes', 'No'] as const).map(opt => {
                    const active = trade.aplusSetup === opt
                    return (
                      <button key={opt} onClick={() => set('aplusSetup', active ? '' : opt)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${active ? (opt === 'Yes' ? 'rgba(34,197,94,0.4)' : 'var(--border-strong)') : 'var(--border)'}`,
                        background: active ? (opt === 'Yes' ? 'rgba(34,197,94,0.1)' : 'var(--bg-active)') : 'transparent',
                        color: active ? (opt === 'Yes' ? '#22c55e' : 'var(--text)') : 'var(--text-dim)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                      >{opt}</button>
                    )
                  })}
                </div>
              </div>

              {/* Row 3: Internal Range Liq | FVG Present | Displacement | Setup Type | Target Logic */}
              <div>
                {fieldLabel('Internal Range Liq')}
                <TFTagPicker bases={['FVG']} selected={trade.internalRangeLiquidity || []} onChange={v => set('internalRangeLiquidity', v)} />
              </div>
              <div>
                {fieldLabel('FVG Present')}
                <TFTagPicker bases={['FVG']} selected={trade.fvgPresent || []} onChange={v => set('fvgPresent', v)} />
              </div>
              <div>
                {fieldLabel('Displacement')}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Yes', 'No'] as const).map(opt => {
                    const active = trade.displacement === opt
                    return (
                      <button key={opt} onClick={() => set('displacement', active ? '' : opt)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                        background: active ? 'var(--bg-active)' : 'transparent',
                        color: active ? 'var(--text)' : 'var(--text-dim)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                      >{opt}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                {fieldLabel('Setup Type')}
                <input value={trade.setupType || ''} onChange={e => set('setupType', e.target.value)}
                  placeholder="Type..." style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div>
                {fieldLabel('Target Logic')}
                <input value={trade.targetLogic || ''} onChange={e => set('targetLogic', e.target.value)}
                  placeholder="Logic..." style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>

              {/* Row 4: External Range Liq | iFVG Present | Payback Used | Risk Placement Logic | (empty) */}
              <div>
                {fieldLabel('External Range Liq')}
                <TFTagPicker bases={['Swing High', 'Swing Low']} selected={trade.externalRangeLiquidity || []} onChange={v => set('externalRangeLiquidity', v)} />
              </div>
              <div>
                {fieldLabel('iFVG Present')}
                <TFTagPicker bases={['iFVG']} selected={trade.ifvgPresent || []} onChange={v => set('ifvgPresent', v)} />
              </div>
              <div>
                {fieldLabel('Payback Used')}
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['Yes', 'No'] as const).map(opt => {
                    const active = trade.paybackUsed === opt
                    return (
                      <button key={opt} onClick={() => set('paybackUsed', active ? '' : opt)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                        background: active ? 'var(--bg-active)' : 'transparent',
                        color: active ? 'var(--text)' : 'var(--text-dim)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                      >{opt}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                {fieldLabel('Risk Placement Logic')}
                <input value={trade.riskPlacementLogic || ''} onChange={e => set('riskPlacementLogic', e.target.value)}
                  placeholder="Logic..." style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div />

              {/* Row 5: Liquidity Swept | Timeframe Used | News Impact | (empty) | (empty) */}
              <div>
                {fieldLabel('Liquidity Swept')}
                <TFTagPicker bases={['Swing High', 'Swing Low']} selected={trade.liquiditySwept || []} onChange={v => set('liquiditySwept', v)} />
              </div>
              <div>
                {fieldLabel('Timeframe Used')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {TIMEFRAMES.map(tf => {
                    const active = trade.timeframeExecuted === tf
                    return (
                      <button key={tf} onClick={() => set('timeframeExecuted', active ? '' : tf)} style={{
                        padding: '4px 8px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                        border: `1px solid ${active ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                        background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
                        color: active ? '#22c55e' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-mid)' } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
                      >{tf}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                {fieldLabel('News Impact')}
                <input value={trade.newsImpact || ''} onChange={e => set('newsImpact', e.target.value)}
                  placeholder="Low / Med / High..." style={inputBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
              </div>
              <div />
              <div />

            </div>
          )}

          {/* ── TAB 2: SCREENSHOTS & NOTES ── */}
          {activeTab === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                    background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8,
                    color: 'var(--text-dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s', fontFamily: 'inherit', alignSelf: 'flex-start',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                ><Plus size={12} /> Add Screenshot</button>
              </div>
              <div>
                {fieldLabel('Notes')}
                <textarea
                  value={trade.notes || ''}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Post-trade reflections, what went well, what to improve..."
                  rows={4}
                  style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
                />
              </div>
            </div>
          )}

          <div style={{ height: 8 }} />
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
  const [customDols, setCustomDols] = useState<string[]>(() => loadCustomDols())
  const [newDolInput, setNewDolInput] = useState('')
  const [customExitReasons, setCustomExitReasons] = useState<string[]>(() => loadCustomExitReasons())
  const [newExitReasonInput, setNewExitReasonInput] = useState('')

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

  const addDolInline = (raw: string) => {
    const val = raw.trim()
    if (!val) return
    const updated = customDols.includes(val) ? customDols : [...customDols, val]
    setCustomDols(updated)
    saveCustomDols(updated)
    const cur = trade.dol || []
    if (!cur.includes(val)) set('dol', [...cur, val])
    setNewDolInput('')
  }

  const removeDolFromLibraryInline = (val: string) => {
    const updated = customDols.filter(d => d !== val)
    setCustomDols(updated)
    saveCustomDols(updated)
  }

  const addExitReasonInline = (raw: string) => {
    const val = raw.trim()
    if (!val) return
    const updated = customExitReasons.includes(val) ? customExitReasons : [...customExitReasons, val]
    setCustomExitReasons(updated)
    saveCustomExitReasons(updated)
    const cur = trade.exitReason || []
    if (!cur.includes(val)) set('exitReason', [...cur, val])
    setNewExitReasonInput('')
  }

  const removeExitReasonFromLibraryInline = (val: string) => {
    const updated = customExitReasons.filter(r => r !== val)
    setCustomExitReasons(updated)
    saveCustomExitReasons(updated)
  }

  const pnlVal = parseFloat(trade.pnl)
  const hasPnl = trade.pnl !== ''
  const pnlColor = pnlVal > 0 ? 'var(--color-win)' : pnlVal < 0 ? 'var(--color-loss)' : 'var(--text-sub)'
  const rrVal = calcRR(trade.takeProfit, trade.stopLoss)
  const rrColor = !rrVal ? 'var(--text-dim)' : parseFloat(rrVal) >= 1 ? 'var(--color-win)' : 'var(--color-loss)'
  const showDrawdown = trade.result === 'Win' || trade.result === 'BE' || trade.result === "Didn't take"

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', padding: '26px 36px 32px' }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, padding: '6px 10px', borderRadius: 7, border: `1px solid ${confirmDelete ? 'rgba(239,68,68,0.4)' : 'var(--border-mid)'}`, background: confirmDelete ? 'rgba(239,68,68,0.1)' : 'transparent', color: confirmDelete ? '#ef4444' : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!confirmDelete) { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' } }}
            onMouseLeave={e => { if (!confirmDelete) { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-mid)' } }}
          ><Trash2 size={11} />{confirmDelete ? 'Confirm?' : 'Delete'}</button>
          <button onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: saved ? 'rgba(34,197,94,0.12)' : 'var(--btn-bg)', color: saved ? '#22c55e' : 'var(--btn-text)', outline: saved ? '1px solid rgba(34,197,94,0.25)' : 'none', transition: 'all 0.2s', fontFamily: 'inherit' }}>
            <Save size={12} />{saved ? 'Saved!' : 'Save'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          ><X size={15} /></button>
        </div>

        {/* ── Row 1: Date / Time / Account / Symbol / Direction / Contracts / Setup ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 110px 1fr 110px 140px 110px 1fr', gap: 16 }}>
          <div>
            {fieldLabel('Date')}
            <input type="date" value={date} onChange={e => onDateChange(e.target.value)}
              style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Time')}
            <input type="time" value={trade.time || ''} onChange={e => set('time', e.target.value)}
              style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
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
                        padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                        border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                        background: active ? 'var(--bg-active)' : 'transparent',
                        color: active ? 'var(--text)' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-sub)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
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
              style={{ ...inputBase, cursor: 'pointer' }} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              <option value="">—</option>
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            {fieldLabel('Direction')}
            <div style={{ display: 'flex', gap: 5, height: 36 }}>
              {(['Long', 'Short'] as const).map(side => {
                const active = trade.side === side
                const col = side === 'Long' ? '#22d3ee' : '#ef4444'
                return (
                  <button key={side} onClick={() => set('side', side)} style={{
                    flex: 1, borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: `1px solid ${active ? col + '44' : 'var(--border)'}`,
                    background: active ? `${col}14` : 'transparent',
                    color: active ? col : 'var(--text-dim)',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                  >{side}</button>
                )
              })}
            </div>
          </div>
          <div>
            {fieldLabel('Contracts')}
            <input type="number" value={trade.contracts} onChange={e => set('contracts', e.target.value)}
              placeholder="1" min="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Setup')}
            <input value={trade.setup || ''} onChange={e => set('setup', e.target.value)}
              placeholder="5m FVG, OB retest…" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
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
                placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fieldLabel('Calc P&L')}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', padding: '0 10px' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: hasPnl ? pnlColor : 'var(--text-dim)' }}>
                {hasPnl ? (pnlVal >= 0 ? '+' : '') + formatCurrency(pnlVal) : '—'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fieldLabel('R:R')}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', padding: '0 10px' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: rrColor }}>
                {rrVal ? `${parseFloat(rrVal) >= 0 ? '+' : ''}${rrVal}R` : '—'}
              </span>
            </div>
          </div>
          {showDrawdown && (
            <div>
              {fieldLabel('Drawdown (pts)')}
              <input type="number" value={trade.drawdown} onChange={e => set('drawdown', e.target.value)}
                placeholder="0" min="0" step="0.25" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
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
            {(customDols.length > 0 || (trade.dol || []).some(d => !customDols.includes(d))) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                {customDols.map(d => {
                  const active = (trade.dol || []).includes(d)
                  return (
                    <div key={d} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, overflow: 'hidden', border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-mid)'}`, background: active ? 'var(--bg-active)' : 'transparent' }}>
                      <button onClick={() => toggleDol(d)} style={{ padding: '5px 8px 5px 12px', fontSize: 14, fontWeight: 500, background: 'none', border: 'none', color: active ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s' }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-sub)' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                      >{d}</button>
                      <button onClick={() => removeDolFromLibraryInline(d)} title="Remove from library" style={{ padding: '5px 7px 5px 2px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                      ><X size={9} /></button>
                    </div>
                  )
                })}
                {(trade.dol || []).filter(d => !customDols.includes(d)).map(d => (
                  <TagChip key={d} label={d} active={true} onClick={() => toggleDol(d)} />
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                value={newDolInput}
                onChange={e => setNewDolInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDolInline(newDolInput) } }}
                placeholder="Add DOL…"
                style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
              />
              <button onClick={() => addDolInline(newDolInput)} style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)',
                background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600,
                cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
              >+</button>
            </div>
          </div>
        </div>

        {/* ── Row 2b: Prop Firm / Trade # / Fees / Duration / Target Price ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16 }}>
          <div>
            {fieldLabel('Prop Firm')}
            <input value={trade.propFirm || ''} onChange={e => set('propFirm', e.target.value)}
              placeholder="e.g. Apex" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Trade # for day')}
            <input type="number" value={trade.tradeNumber} onChange={e => set('tradeNumber', e.target.value)}
              placeholder="1" min="1" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Fees $')}
            <input type="number" value={trade.fees} onChange={e => set('fees', e.target.value)}
              placeholder="0.00" min="0" step="0.01" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Duration (mins)')}
            <input value={trade.duration} onChange={e => set('duration', e.target.value)}
              placeholder="e.g. 45" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Target Price')}
            <input type="number" value={trade.targetPrice} onChange={e => set('targetPrice', e.target.value)}
              placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
        </div>

        {/* ── ICT / Trade Context ── */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>ICT / Trade Context</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, alignItems: 'start' }}>

            {/* Row 1 */}
            <div>
              {fieldLabel('HTF Bias')}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['Long', 'Short'] as const).map(side => {
                  const active = trade.htfBias === side
                  const col = side === 'Long' ? '#22d3ee' : '#ef4444'
                  return (
                    <button key={side} onClick={() => set('htfBias', active ? '' : side)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: `1px solid ${active ? col + '44' : 'var(--border)'}`,
                      background: active ? `${col}14` : 'transparent',
                      color: active ? col : 'var(--text-dim)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                    >{side}</button>
                  )
                })}
              </div>
            </div>
            <div>
              {fieldLabel('SMT Present')}
              <TFTagPicker bases={['SMT']} selected={trade.smtPresent || []} onChange={v => set('smtPresent', v)} />
            </div>
            <div>
              {fieldLabel('Rejection Block')}
              <TFTagPicker bases={['RB']} selected={trade.rejectionBlock || []} onChange={v => set('rejectionBlock', v)} />
            </div>
            <div>
              {fieldLabel('Market Condition')}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['Consolidation', 'Distribution'] as const).map(mc => {
                  const short = mc === 'Consolidation' ? 'Consol.' : 'Distrib.'
                  const active = trade.marketCondition === mc
                  return (
                    <button key={mc} onClick={() => set('marketCondition', active ? '' : mc)} style={{
                      flex: 1, padding: '8px 2px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                      background: active ? 'var(--bg-active)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-dim)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                    >{short}</button>
                  )
                })}
              </div>
            </div>
            <div>
              {fieldLabel('News Present')}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['Yes', 'No'] as const).map(opt => {
                  const active = trade.newsPresent === opt
                  return (
                    <button key={opt} onClick={() => set('newsPresent', active ? '' : opt)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: `1px solid ${active ? (opt === 'Yes' ? '#fbbf2444' : 'var(--border-strong)') : 'var(--border)'}`,
                      background: active ? (opt === 'Yes' ? '#fbbf2414' : 'var(--bg-active)') : 'transparent',
                      color: active ? (opt === 'Yes' ? '#fbbf24' : 'var(--text)') : 'var(--text-dim)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                    >{opt}</button>
                  )
                })}
              </div>
            </div>

            {/* Row 2 */}
            <div>
              {fieldLabel('OB Present')}
              <TFTagPicker bases={['OB']} selected={trade.orderBlock || []} onChange={v => set('orderBlock', v)} />
            </div>
            <div>
              {fieldLabel('Entry Model')}
              <input value={trade.entryModel || ''} onChange={e => set('entryModel', e.target.value)}
                placeholder="Model name..." style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {fieldLabel('Exit Reason')}
              {(customExitReasons.length > 0 || (trade.exitReason || []).some(r => !customExitReasons.includes(r))) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                  {customExitReasons.map(r => {
                    const active = (trade.exitReason || []).includes(r)
                    return (
                      <div key={r} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, overflow: 'hidden', border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-mid)'}`, background: active ? 'var(--bg-active)' : 'transparent' }}>
                        <button onClick={() => { const l = trade.exitReason || []; set('exitReason', l.includes(r) ? l.filter(x => x !== r) : [...l, r]) }} style={{ padding: '5px 8px 5px 12px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: active ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s' }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-sub)' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                        >{r}</button>
                        <button onClick={() => removeExitReasonFromLibraryInline(r)} title="Remove from library" style={{ padding: '5px 7px 5px 2px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                        ><X size={9} /></button>
                      </div>
                    )
                  })}
                  {(trade.exitReason || []).filter(r => !customExitReasons.includes(r)).map(r => (
                    <TagChip key={r} label={r} active={true} onClick={() => { const l = trade.exitReason || []; set('exitReason', l.filter(x => x !== r)) }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  value={newExitReasonInput}
                  onChange={e => setNewExitReasonInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExitReasonInline(newExitReasonInput) } }}
                  placeholder="Add exit reason…"
                  style={{ ...inputBase, fontSize: 13, padding: '7px 10px' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
                />
                <button onClick={() => addExitReasonInline(newExitReasonInput)} style={{
                  padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)',
                  background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600,
                  cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
                >+</button>
              </div>
            </div>
            <div>
              {fieldLabel('A+ Setup')}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['Yes', 'No'] as const).map(opt => {
                  const active = trade.aplusSetup === opt
                  return (
                    <button key={opt} onClick={() => set('aplusSetup', active ? '' : opt)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: `1px solid ${active ? (opt === 'Yes' ? 'rgba(34,197,94,0.4)' : 'var(--border-strong)') : 'var(--border)'}`,
                      background: active ? (opt === 'Yes' ? 'rgba(34,197,94,0.1)' : 'var(--bg-active)') : 'transparent',
                      color: active ? (opt === 'Yes' ? '#22c55e' : 'var(--text)') : 'var(--text-dim)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                    >{opt}</button>
                  )
                })}
              </div>
            </div>
            <div>
              {fieldLabel('Setup Type')}
              <input value={trade.setupType || ''} onChange={e => set('setupType', e.target.value)}
                placeholder="Type..." style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>

            {/* Row 3 */}
            <div>
              {fieldLabel('Internal Range Liq')}
              <TFTagPicker bases={['FVG']} selected={trade.internalRangeLiquidity || []} onChange={v => set('internalRangeLiquidity', v)} />
            </div>
            <div>
              {fieldLabel('FVG Present')}
              <TFTagPicker bases={['FVG']} selected={trade.fvgPresent || []} onChange={v => set('fvgPresent', v)} />
            </div>
            <div>
              {fieldLabel('Displacement')}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['Yes', 'No'] as const).map(opt => {
                  const active = trade.displacement === opt
                  return (
                    <button key={opt} onClick={() => set('displacement', active ? '' : opt)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                      background: active ? 'var(--bg-active)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-dim)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                    >{opt}</button>
                  )
                })}
              </div>
            </div>
            <div>
              {fieldLabel('Target Logic')}
              <input value={trade.targetLogic || ''} onChange={e => set('targetLogic', e.target.value)}
                placeholder="Logic..." style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {fieldLabel('Risk Placement Logic')}
              <input value={trade.riskPlacementLogic || ''} onChange={e => set('riskPlacementLogic', e.target.value)}
                placeholder="Logic..." style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>

            {/* Row 4 */}
            <div>
              {fieldLabel('External Range Liq')}
              <TFTagPicker bases={['Swing High', 'Swing Low']} selected={trade.externalRangeLiquidity || []} onChange={v => set('externalRangeLiquidity', v)} />
            </div>
            <div>
              {fieldLabel('iFVG Present')}
              <TFTagPicker bases={['iFVG']} selected={trade.ifvgPresent || []} onChange={v => set('ifvgPresent', v)} />
            </div>
            <div>
              {fieldLabel('Payback Used')}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['Yes', 'No'] as const).map(opt => {
                  const active = trade.paybackUsed === opt
                  return (
                    <button key={opt} onClick={() => set('paybackUsed', active ? '' : opt)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                      border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
                      background: active ? 'var(--bg-active)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-dim)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                    >{opt}</button>
                  )
                })}
              </div>
            </div>
            <div>
              {fieldLabel('Liquidity Swept')}
              <TFTagPicker bases={['Swing High', 'Swing Low']} selected={trade.liquiditySwept || []} onChange={v => set('liquiditySwept', v)} />
            </div>
            <div />

            {/* Row 5 */}
            <div>
              {fieldLabel('Timeframe Used')}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {TIMEFRAMES.map(tf => {
                  const active = trade.timeframeExecuted === tf
                  return (
                    <button key={tf} onClick={() => set('timeframeExecuted', active ? '' : tf)} style={{
                      padding: '4px 8px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                      border: `1px solid ${active ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                      background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
                      color: active ? '#22c55e' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-mid)' } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
                    >{tf}</button>
                  )
                })}
              </div>
            </div>
            <div>
              {fieldLabel('News Impact')}
              <input value={trade.newsImpact || ''} onChange={e => set('newsImpact', e.target.value)}
                placeholder="Low / Med / High..." style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div />
            <div />
            <div />
          </div>
        </div>

        {/* ── Notes ── */}
        <div>
          {fieldLabel('Notes')}
          <textarea
            value={trade.notes || ''}
            onChange={e => set('notes', e.target.value)}
            placeholder="Post-trade reflections, what went well, what to improve..."
            rows={3}
            style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }}
            onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
          />
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
  const pnlColor = pnl > 0 ? '#22c55e' : pnl < 0 ? '#ef4444' : 'var(--text-muted)'
  const rrVal = calcRR(trade.takeProfit, trade.stopLoss)
  const rrNum = rrVal ? parseFloat(rrVal) : null
  const rrColor = rrNum === null ? 'var(--text-dim)' : rrNum >= 1 ? '#22c55e' : '#ef4444'
  const rc = RESULT_COLORS[trade.result] || 'var(--text-sub)'
  const gc = trade.grade ? (GRADE_COLORS[trade.grade] || 'var(--text-sub)') : null
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
        borderLeft: `2px solid ${expanded ? 'var(--border-strong)' : 'transparent'}`,
        background: expanded ? 'var(--bg-active)' : 'transparent',
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{dateLabel}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{trade.symbol || '—'}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '3px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, width: 'fit-content',
        background: trade.side === 'Long' ? 'rgba(34,211,238,0.12)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${trade.side === 'Long' ? 'rgba(34,211,238,0.25)' : 'rgba(239,68,68,0.2)'}`,
        color: trade.side === 'Long' ? '#22d3ee' : '#ef4444',
      }}>{trade.side}</span>
      <span style={{ fontSize: 15, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10 }}>{setupLabel}</span>
      <span style={{ fontSize: 14, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sessionLabel}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: pnlColor }}>
        {trade.pnl ? (pnl >= 0 ? '+' : '') + formatCurrency(pnl) : '—'}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: rrColor }}>
        {rrVal ? `${rrNum! >= 0 ? '+' : ''}${rrVal}R` : '—'}
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: '3px 8px', borderRadius: 999, fontSize: 13, fontWeight: 700, width: 'fit-content',
        background: `${rc}18`, border: `1px solid ${rc}44`, color: rc,
      }}>{trade.result}</span>
      {gc ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '3px 8px', borderRadius: 6, fontSize: 14, fontWeight: 700, width: 'fit-content',
          background: `${gc}18`, border: `1px solid ${gc}44`, color: gc,
        }}>{trade.grade}</span>
      ) : (
        <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>—</span>
      )}
      <ChevronDown size={14} color="var(--text-muted)" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s', justifySelf: 'end' }} />
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
    fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.09em', padding: '9px 0',
  }
  const selectStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--bg-hover)' : 'var(--bg-input)',
    border: `1px solid ${active ? 'var(--border-mid)' : 'var(--border)'}`,
    borderRadius: 8, padding: '6px 26px 6px 10px',
    fontSize: 14, color: active ? 'var(--text)' : 'var(--text-muted)',
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
      <div style={{ flexShrink: 0, padding: '12px 36px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-panel)' }}>
        <span style={{ fontSize: 15, color: 'var(--text-muted)', marginRight: 4, whiteSpace: 'nowrap' }}>Log, scan and review every trade.</span>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trades…"
            style={{ ...inputBase, paddingLeft: 30, fontSize: 15, padding: '7px 12px 7px 30px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-mid)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
        </div>
        <button onClick={() => openNew()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--btn-bg)', color: 'var(--btn-text)', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-bg)')}
        ><Plus size={13} /> New Trade</button>
        {[
          { label: 'Result',  value: filterResult,  opts: ['All', 'Win', 'Loss', 'BE', "Didn't take"],                              set: setFilterResult  },
          { label: 'Session', value: filterSession, opts: ['All', 'Asia Session', 'London Session', 'Pre-market', 'New York AM Session', 'Pre-market Asia Session'], set: setFilterSession },
          { label: 'P&L',    value: filterPnl,     opts: ['All', 'Profitable', 'Unprofitable'],                                    set: setFilterPnl     },
        ].map(f => (
          <div key={f.label} style={{ position: 'relative' }}>
            <select value={f.value} onChange={e => f.set(e.target.value)} style={selectStyle(f.value !== 'All')}>
              {f.opts.map(o => <option key={o} value={o}>{f.label}: {o}</option>)}
            </select>
            <ChevronDown size={10} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>
        ))}
        {filtersActive && (
          <button onClick={() => { setSearch(''); setFilterResult('All'); setFilterSession('All'); setFilterPnl('All') }}
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-mid)', borderRadius: 8, color: 'var(--text-dim)', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
          >Clear</button>
        )}
      </div>

      {/* Column headers */}
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: COL, padding: '0 36px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
        {['Date', 'Pair', 'Direction', 'Setup', 'Session', 'Net P&L', 'R', 'Result', 'Grade', ''].map(h => (
          <div key={h} style={hStyle}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 0', gap: 12 }}>
            <BookOpen size={30} color="var(--text-dim)" />
            <p style={{ color: 'var(--text-muted)', fontSize: 16, margin: 0 }}>
              {allTrades.length === 0 ? 'No trades yet — click New Trade to add one' : 'No trades match your filters'}
            </p>
          </div>
        ) : (
          filtered.map((t, idx) => {
            const key = `${t.date}::${t.id}`
            const isExpanded = expandedKey === key
            const rowBg = idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg)'

            return (
              <div key={key} style={{ borderBottom: `1px solid var(--border)`, background: isExpanded ? 'var(--bg-active)' : rowBg }}>
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
