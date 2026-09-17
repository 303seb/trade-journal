import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus, Trash2, ImageIcon, X, Search, Save, ChevronDown, BookOpen, Check, Zap, Upload, Settings2,
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import type { JournalEntry, TradeLog, TradeResult, TradingRule, TradingAccount } from '../types'
import { formatCurrency } from '../utils/stats'
import { tradeUnitValue, fmtUnit } from '../utils/units'
import { useMobile } from '../hooks/useMobile'
import { ControlBar, DEFAULT_CONTROLS } from '../components/ControlBar'
import type { Controls } from '../components/ControlBar'
import { QuickAddModal } from '../components/QuickAddModal'
import { ImportTradesModal } from '../components/ImportTradesModal'

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
    entryPrice: '', exitPrice: '', exitPartials: [], targetPrice: '',
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
    entryModel: [],
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
    copyTradedAccounts: [],
    playbookUsed: '',
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
function calcPartialsPnl(symbol: string, side: 'Long' | 'Short', entry: string, partials: { price: string; qty: string }[]): string {
  const pv = PVMAP[symbol]
  const e = parseFloat(entry)
  if (!pv || isNaN(e) || partials.length === 0) return ''
  let total = 0
  for (const p of partials) {
    const price = parseFloat(p.price)
    const qty = parseFloat(p.qty)
    if (isNaN(price) || isNaN(qty) || qty <= 0) continue
    total += (side === 'Long' ? price - e : e - price) * pv * qty
  }
  return total.toFixed(2)
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
const TIMEFRAMES = ['1m', '2m', '3m', '4m', '5m', '15m', '30m', '1hr', '4hr', 'Daily']
const STDV_LEVELS = [-4, -2, -1]

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
const EXIT_REASONS = ['Full TP', 'Partials', 'Trailed Out', 'BE', 'Stop Loss']
const MARKET_CONDITIONS = ['ERL to IRL', 'IRL to ERL']
const HTF_BIAS_OPTIONS = ['Bullish', 'Bearish', 'Neutral']

const DOL_STORAGE_KEY = 'journal_custom_dols'
const ENTRY_MODEL_STORAGE_KEY = 'journal_custom_entry_models'

function loadCustomDols(): string[] {
  try { return JSON.parse(localStorage.getItem(DOL_STORAGE_KEY) || '[]') } catch { return [] }
}
function saveCustomDols(dols: string[]) {
  localStorage.setItem(DOL_STORAGE_KEY, JSON.stringify(dols))
}
function loadCustomEntryModels(): string[] {
  try { return JSON.parse(localStorage.getItem(ENTRY_MODEL_STORAGE_KEY) || '[]') } catch { return [] }
}
function saveCustomEntryModels(models: string[]) {
  localStorage.setItem(ENTRY_MODEL_STORAGE_KEY, JSON.stringify(models))
}
// Coerce a possibly-legacy string field into a string[] for multi-select fields.
const asArray = (v: unknown): string[] => Array.isArray(v) ? v as string[] : (v ? [String(v)] : [])

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-mid)', borderRadius: 8,
  padding: '10px 13px', fontSize: 18, color: 'var(--text)', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: 'inherit', minHeight: '46px',
}
const selectBase: React.CSSProperties = {
  ...inputBase,
  cursor: 'pointer',
  WebkitAppearance: 'none',
  appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888888' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 13px center',
  paddingRight: '36px',
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

// ── Multi-select dropdown ─────────────────────────────────────────────────────

function MultiSelectDropdown({ options, selected, onChange, placeholder = '—' }: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt])
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...selectBase, textAlign: 'left', display: 'flex', alignItems: 'center' }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected.length ? 'var(--text)' : 'var(--text-muted)' }}>
          {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: 'var(--shadow-card)', maxHeight: 240, overflowY: 'auto', padding: 4 }}>
          {options.length === 0 && <div style={{ padding: '8px 10px', fontSize: 14, color: 'var(--text-dim)' }}>No options</div>}
          {options.map(opt => {
            const active = selected.includes(opt)
            return (
              <div key={opt} onClick={() => toggle(opt)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 15, color: active ? 'var(--text)' : 'var(--text-sub)', background: active ? 'var(--bg-active)' : 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = active ? 'var(--bg-active)' : 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent')}
              >
                <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-mid)'}`, background: active ? 'var(--btn-bg)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {active && <Check size={11} color="var(--btn-text)" strokeWidth={3} />}
                </span>
                {opt}
              </div>
            )
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {selected.map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px 2px 8px', borderRadius: 999, fontSize: 12, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
              {s}
              <button type="button" onClick={() => toggle(s)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-loss)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              ><X size={9} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared pill / tag helpers ─────────────────────────────────────────────────



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
  const [customEntryModels, setCustomEntryModels] = useState<string[]>(() => loadCustomEntryModels())
  const [newEntryModelInput, setNewEntryModelInput] = useState('')
  const [newExitPriceInput, setNewExitPriceInput] = useState('')
  const [newExitQtyInput, setNewExitQtyInput] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // P&L sums across the original account + every account the trade was copy traded to.
  const pnlMultiplier = (t: TradeLog) =>
    t.copyTraded === 'Yes' ? 1 + (t.copyTradedAccounts?.length ?? 0) : 1

  const computeStoredPnl = (t: TradeLog): string => {
    const base = (t.exitPartials && t.exitPartials.length > 0)
      ? calcPartialsPnl(t.symbol, t.side, t.entryPrice, t.exitPartials)
      : calcTradePnl(t.symbol, t.side, t.entryPrice, t.exitPrice, t.contracts)
    if (base === '') return ''
    return (parseFloat(base) * pnlMultiplier(t)).toFixed(2)
  }

  const addExitPartial = () => {
    const price = newExitPriceInput.trim()
    const qty = newExitQtyInput.trim()
    if (!price || isNaN(parseFloat(price)) || !qty || isNaN(parseFloat(qty)) || parseFloat(qty) <= 0) return
    const newPartials = [...(trade.exitPartials || []), { price, qty }]
    const totalQty = newPartials.reduce((s, p) => s + parseFloat(p.qty), 0)
    const avgPrice = (newPartials.reduce((s, p) => s + parseFloat(p.price) * parseFloat(p.qty), 0) / totalQty).toFixed(4)
    setTrade(prev => {
      const next = { ...prev, exitPartials: newPartials, exitPrice: avgPrice }
      next.pnl = computeStoredPnl(next)
      return next
    })
    setNewExitPriceInput('')
    setNewExitQtyInput('')
  }

  const removeExitPartial = (idx: number) => {
    const newPartials = (trade.exitPartials || []).filter((_, i) => i !== idx)
    if (newPartials.length === 0) {
      setTrade(prev => ({ ...prev, exitPartials: [], exitPrice: '', pnl: '' }))
      return
    }
    const totalQty = newPartials.reduce((s, p) => s + parseFloat(p.qty), 0)
    const avgPrice = (newPartials.reduce((s, p) => s + parseFloat(p.price) * parseFloat(p.qty), 0) / totalQty).toFixed(4)
    setTrade(prev => {
      const next = { ...prev, exitPartials: newPartials, exitPrice: avgPrice }
      next.pnl = computeStoredPnl(next)
      return next
    })
  }

  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => {
    setTrade(prev => {
      const next = { ...prev, [k]: v }
      if (['symbol', 'side', 'entryPrice', 'exitPrice', 'contracts', 'copyTraded', 'copyTradedAccounts'].includes(k as string)) {
        next.pnl = computeStoredPnl(next)
      }
      return next
    })
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

  const addEntryModel = (raw: string) => {
    const val = raw.trim()
    if (!val) return
    const updated = customEntryModels.includes(val) ? customEntryModels : [...customEntryModels, val]
    setCustomEntryModels(updated)
    saveCustomEntryModels(updated)
    const cur = asArray(trade.entryModel)
    if (!cur.includes(val)) set('entryModel', [...cur, val])
    setNewEntryModelInput('')
  }

  const removeEntryModelFromLibrary = (val: string) => {
    const updated = customEntryModels.filter(m => m !== val)
    setCustomEntryModels(updated)
    saveCustomEntryModels(updated)
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
  // Risk scales with the number of copy-traded accounts, so R stays per-setup.
  const rMultiple = riskDollars > 0 && hasPnl ? parseFloat((grossPnl / (riskDollars * pnlMultiplier(trade))).toFixed(2)) : null

  const accountOptions = tradingAccounts.length > 0 ? tradingAccounts.map(a => a.name) : ['Live', 'Funded', 'Eval']

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
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 28px 28px' }}>

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
                  style={selectBase}
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
                  style={selectBase}
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
                  style={selectBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                {trade.copyTraded === 'Yes' && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 5 }}>Copied to accounts</div>
                    <MultiSelectDropdown
                      options={accountOptions}
                      selected={trade.copyTradedAccounts || []}
                      onChange={next => set('copyTradedAccounts', next)}
                      placeholder="Select accounts…"
                    />
                    <div style={{ fontSize: 12, color: (trade.copyTradedAccounts || []).length > 0 ? '#22c55e' : '#fbbf24', marginTop: 5, fontWeight: 600 }}>
                      {(trade.copyTradedAccounts || []).length > 0
                        ? `P&L ×${1 + (trade.copyTradedAccounts || []).length} — original + ${(trade.copyTradedAccounts || []).length} copied = ${1 + (trade.copyTradedAccounts || []).length} accounts`
                        : 'Select the account(s) this trade was copied to, to sum its P&L'}
                    </div>
                  </div>
                )}
              </div>
              <div>
                {fieldLabel('Session')}
                <select
                  value={(trade.sessions || [])[0] || ''}
                  onChange={e => set('sessions', e.target.value ? [e.target.value] : [])}
                  style={selectBase}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                  <option value="">—</option>
                  {SESSION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                {fieldLabel('Direction')}
                <select value={trade.side} onChange={e => set('side', e.target.value as 'Long' | 'Short')}
                  style={{ ...selectBase, color: trade.side === 'Long' ? '#22c55e' : 'var(--color-loss)' }}
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
                {fieldLabel('Exit Price(s)')}
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="number"
                    value={newExitPriceInput}
                    onChange={e => setNewExitPriceInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExitPartial() } }}
                    placeholder="Price"
                    style={{ ...inputBase, flex: 2, fontSize: 15 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
                  />
                  <input
                    type="number"
                    value={newExitQtyInput}
                    onChange={e => setNewExitQtyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExitPartial() } }}
                    placeholder="Qty"
                    min="1"
                    style={{ ...inputBase, flex: 1, fontSize: 15 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
                  />
                  <button
                    onClick={addExitPartial}
                    style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', fontSize: 18, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s', lineHeight: 1 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
                  >+</button>
                </div>
                {(trade.exitPartials || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {(trade.exitPartials || []).map((p, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 12, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
                        {p.price} × {p.qty}
                        <button onClick={() => removeExitPartial(i)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-loss)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        ><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                )}
                {(trade.exitPartials || []).length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {(trade.exitPartials || []).reduce((s, p) => s + parseFloat(p.qty), 0)} contracts · wt. avg {parseFloat(trade.exitPrice || '0').toFixed(2)}
                  </div>
                )}
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
                  style={{ ...selectBase, color: RESULT_COLORS[trade.result] || 'var(--text)', fontWeight: 600 }}
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
                  style={{ ...selectBase, color: trade.grade ? (GRADE_COLORS[trade.grade] || 'var(--text)') : 'var(--text-muted)', fontWeight: 700 }}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>

                {/* Row 1: HTF Bias | Draw on Liquidity | Internal Range Liq | External Range Liq | Liquidity Swept */}
                <div>
                  {fieldLabel('HTF Bias')}
                  <select value={trade.htfBias || ''} onChange={e => set('htfBias', e.target.value)}
                    style={{ ...selectBase, color: trade.htfBias === 'Bullish' ? '#22c55e' : trade.htfBias === 'Bearish' ? 'var(--color-loss)' : 'var(--text)' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {HTF_BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('Draw on Liquidity')}
                  <MultiSelectDropdown
                    options={customDols}
                    selected={trade.dol || []}
                    onChange={next => set('dol', next)}
                  />
                </div>
                <div>
                  {fieldLabel('Internal Range Liq')}
                  <MultiSelectDropdown
                    options={TIMEFRAMES.map(tf => `FVG (${tf})`)}
                    selected={trade.internalRangeLiquidity || []}
                    onChange={next => set('internalRangeLiquidity', next)}
                  />
                </div>
                <div>
                  {fieldLabel('External Range Liq')}
                  <MultiSelectDropdown
                    options={(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => `${b} (${tf})`))}
                    selected={trade.externalRangeLiquidity || []}
                    onChange={next => set('externalRangeLiquidity', next)}
                  />
                </div>
                <div>
                  {fieldLabel('Liquidity Swept')}
                  <MultiSelectDropdown
                    options={(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => `${b} (${tf})`))}
                    selected={trade.liquiditySwept || []}
                    onChange={next => set('liquiditySwept', next)}
                  />
                </div>

                {/* Row 2: SMT Present | CISD Present | Displacement | FVG Present | iFVG Present */}
                <div>
                  {fieldLabel('SMT Present')}
                  <MultiSelectDropdown
                    options={TIMEFRAMES.map(tf => `SMT (${tf})`)}
                    selected={trade.smtPresent || []}
                    onChange={next => set('smtPresent', next)}
                  />
                </div>
                <div>
                  {fieldLabel('CISD Present')}
                  <MultiSelectDropdown
                    options={TIMEFRAMES.map(tf => `CISD (${tf})`)}
                    selected={trade.cisdPresent || []}
                    onChange={next => set('cisdPresent', next)}
                  />
                </div>
                <div>
                  {fieldLabel('Displacement')}
                  <select value={trade.displacement || ''} onChange={e => set('displacement', e.target.value)}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  {fieldLabel('FVG Present')}
                  <MultiSelectDropdown
                    options={TIMEFRAMES.map(tf => `FVG (${tf})`)}
                    selected={trade.fvgPresent || []}
                    onChange={next => set('fvgPresent', next)}
                  />
                </div>
                <div>
                  {fieldLabel('iFVG Present')}
                  <MultiSelectDropdown
                    options={TIMEFRAMES.map(tf => `iFVG (${tf})`)}
                    selected={trade.ifvgPresent || []}
                    onChange={next => set('ifvgPresent', next)}
                  />
                </div>

                {/* Row 3: Rejection Block | OTE | STDV | Entry Model | Setup Type */}
                <div>
                  {fieldLabel('Rejection Block')}
                  <MultiSelectDropdown
                    options={TIMEFRAMES.map(tf => `RB (${tf})`)}
                    selected={trade.rejectionBlock || []}
                    onChange={next => set('rejectionBlock', next)}
                  />
                </div>
                <div>
                  {fieldLabel('OTE')}
                  <MultiSelectDropdown
                    options={TIMEFRAMES.map(tf => `OTE (${tf})`)}
                    selected={trade.otePresent || []}
                    onChange={next => set('otePresent', next)}
                  />
                </div>
                <div>
                  {fieldLabel('STDV')}
                  <MultiSelectDropdown
                    options={STDV_LEVELS.flatMap(n => TIMEFRAMES.map(tf => `STDV ${n > 0 ? '+' : ''}${n} (${tf})`))}
                    selected={trade.stdvPresent || []}
                    onChange={next => set('stdvPresent', next)}
                  />
                </div>
                <div>
                  {fieldLabel('Entry Model')}
                  <MultiSelectDropdown
                    options={customEntryModels}
                    selected={asArray(trade.entryModel)}
                    onChange={next => set('entryModel', next)}
                  />
                </div>
                <div>
                  {fieldLabel('Setup Type')}
                  <input value={trade.setupType || ''} onChange={e => set('setupType', e.target.value)}
                    placeholder="e.g. Reversal" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                </div>

                {/* Row 4: Playbook Used | Timeframe Used | Market Condition | Exit Reason | Target Logic */}
                <div>
                  {fieldLabel('Playbook Used')}
                  <input value={trade.playbookUsed || ''} onChange={e => set('playbookUsed', e.target.value)}
                    placeholder="e.g. AM Kill Zone" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                </div>
                <div>
                  {fieldLabel('Timeframe Used')}
                  <select value={trade.timeframeExecuted || ''} onChange={e => set('timeframeExecuted', e.target.value)}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('Market Condition')}
                  <select value={trade.marketCondition || ''} onChange={e => set('marketCondition', e.target.value)}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {MARKET_CONDITIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('Exit Reason')}
                  <MultiSelectDropdown
                    options={EXIT_REASONS}
                    selected={trade.exitReason || []}
                    onChange={next => set('exitReason', next)}
                  />
                </div>
                <div>
                  {fieldLabel('Target Logic')}
                  <input value={trade.targetLogic || ''} onChange={e => set('targetLogic', e.target.value)}
                    placeholder="e.g. Previous HOD" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                </div>

                {/* Row 5: Stop Logic | News Present | News Impact | Auto Grade | [empty] */}
                <div>
                  {fieldLabel('Stop Logic')}
                  <input value={trade.riskPlacementLogic || ''} onChange={e => set('riskPlacementLogic', e.target.value)}
                    placeholder="e.g. Below OB low" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                </div>
                <div>
                  {fieldLabel('News Present')}
                  <select value={trade.newsPresent || ''} onChange={e => set('newsPresent', e.target.value)}
                    style={{ ...selectBase, color: trade.newsPresent === 'Yes' ? '#fbbf24' : 'var(--text)' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  {fieldLabel('News Impact')}
                  <select value={trade.newsImpact || ''} onChange={e => set('newsImpact', e.target.value)}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  {fieldLabel('Auto Grade')}
                  <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 18,
                    color: autoGradeResult ? (GRADE_COLORS[autoGradeResult.grade] || 'var(--text)') : 'var(--text-dim)',
                    background: 'var(--bg)',
                    border: `1px solid ${autoGradeResult ? (GRADE_COLORS[autoGradeResult.grade] || 'var(--border)') + '44' : 'var(--border)'}`,
                    letterSpacing: '-0.02em',
                  }}>
                    {autoGradeResult ? `${autoGradeResult.grade} · ${autoGradeResult.score}pts` : '—'}
                  </div>
                </div>
                <div />

              </div>

              {/* ── Library Management ── */}
              <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  {fieldLabel('DOL Library')}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <input value={newDolInput} onChange={e => setNewDolInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDol(newDolInput) } }}
                      placeholder="Add DOL to library…"
                      style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                    <button onClick={() => addDol(newDolInput)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}>+</button>
                  </div>
                  {customDols.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {customDols.map(d => (
                        <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 13, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
                          {d}
                          <button onClick={() => removeDolFromLibrary(d)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-loss)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          ><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  {fieldLabel('Entry Model Library')}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <input value={newEntryModelInput} onChange={e => setNewEntryModelInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEntryModel(newEntryModelInput) } }}
                      placeholder="Add entry model to library…"
                      style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                    <button onClick={() => addEntryModel(newEntryModelInput)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}>+</button>
                  </div>
                  {customEntryModels.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {customEntryModels.map(m => (
                        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 13, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
                          {m}
                          <button onClick={() => removeEntryModelFromLibrary(m)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-loss)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                          ><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
  const isMobile = useMobile()
  const [htfPreview, setHtfPreview] = useState<string | null>(trade.htfImgKey?.startsWith('data:') ? trade.htfImgKey : null)
  const [execPreview, setExecPreview] = useState<string | null>(trade.execImgKey?.startsWith('data:') ? trade.execImgKey : null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [customDols, setCustomDols] = useState<string[]>(() => loadCustomDols())
  const [newDolInput, setNewDolInput] = useState('')
  const [customEntryModels, setCustomEntryModels] = useState<string[]>(() => loadCustomEntryModels())
  const [newEntryModelInput, setNewEntryModelInput] = useState('')

  const pnlMultiplier = (t: TradeLog) =>
    t.copyTraded === 'Yes' ? 1 + (t.copyTradedAccounts?.length ?? 0) : 1

  const computeStoredPnl = (t: TradeLog): string => {
    const base = (t.exitPartials && t.exitPartials.length > 0)
      ? calcPartialsPnl(t.symbol, t.side, t.entryPrice, t.exitPartials)
      : calcTradePnl(t.symbol, t.side, t.entryPrice, t.exitPrice, t.contracts)
    if (base === '') return ''
    return (parseFloat(base) * pnlMultiplier(t)).toFixed(2)
  }

  const set = <K extends keyof TradeLog>(k: K, v: TradeLog[K]) => {
    const next = { ...trade, [k]: v }
    if (['symbol', 'side', 'entryPrice', 'exitPrice', 'contracts', 'copyTraded', 'copyTradedAccounts'].includes(k as string))
      next.pnl = computeStoredPnl(next)
    onUpdate(next)
  }

  const accountOptions = tradingAccounts.length > 0 ? tradingAccounts.map(a => a.name) : ['Live', 'Funded', 'Eval']

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

  const addEntryModelInline = (raw: string) => {
    const val = raw.trim()
    if (!val) return
    const updated = customEntryModels.includes(val) ? customEntryModels : [...customEntryModels, val]
    setCustomEntryModels(updated)
    saveCustomEntryModels(updated)
    const cur = asArray(trade.entryModel)
    if (!cur.includes(val)) set('entryModel', [...cur, val])
    setNewEntryModelInput('')
  }

  const removeEntryModelFromLibraryInline = (val: string) => {
    const updated = customEntryModels.filter(m => m !== val)
    setCustomEntryModels(updated)
    saveCustomEntryModels(updated)
  }

  const grossPnl = parseFloat(trade.pnl) || 0
  const hasPnl = trade.pnl !== ''
  const feesVal = parseFloat(trade.fees || '0') || 0
  const netPnl = grossPnl - feesVal
  const pv = PVMAP[trade.symbol] ?? 0
  const slPts = parseFloat(trade.stopLoss)
  const c = parseFloat(trade.contracts)
  const riskDollars = pv && !isNaN(slPts) && !isNaN(c) && c > 0 && slPts > 0 ? slPts * pv * c : 0
  const rMultiple = riskDollars > 0 && hasPnl ? parseFloat((grossPnl / (riskDollars * pnlMultiplier(trade))).toFixed(2)) : null
  const grossColor = grossPnl > 0 ? 'var(--color-win)' : grossPnl < 0 ? 'var(--color-loss)' : 'var(--text-dim)'
  const netColor = netPnl > 0 ? 'var(--color-win)' : netPnl < 0 ? 'var(--color-loss)' : 'var(--text-dim)'
  const rColor = rMultiple === null ? 'var(--text-dim)' : rMultiple >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  const autoGradeResultInline = calcSetupGrade(trade)

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', padding: isMobile ? '14px 12px 20px' : '26px 36px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 22 }}>

        {/* ── Top controls row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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

        {/* ── Basic Trade Details 5×5 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 10 : 14 }}>

          {/* Row 1: Date | Time | Symbol | Account | Prop Firm */}
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
            {fieldLabel('Symbol')}
            <select value={trade.symbol} onChange={e => set('symbol', e.target.value)}
              style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              <option value="">—</option>
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            {fieldLabel('Account')}
            <select value={(trade.accounts || [])[0] || ''} onChange={e => set('accounts', e.target.value ? [e.target.value] : [])}
              style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              <option value="">—</option>
              {(tradingAccounts.length > 0 ? tradingAccounts.map(a => a.name) : ['Live', 'Funded', 'Eval']).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            {fieldLabel('Prop Firm')}
            <input value={trade.propFirm || ''} onChange={e => set('propFirm', e.target.value)}
              placeholder="e.g. Apex" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>

          {/* Row 2: Copy Traded | Session | Direction | Entry Price | Exit Price */}
          <div>
            {fieldLabel('Copy Traded')}
            <select value={trade.copyTraded || ''} onChange={e => set('copyTraded', e.target.value)}
              style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              <option value="">—</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
            {trade.copyTraded === 'Yes' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 5 }}>Copied to accounts</div>
                <MultiSelectDropdown
                  options={accountOptions}
                  selected={trade.copyTradedAccounts || []}
                  onChange={next => set('copyTradedAccounts', next)}
                  placeholder="Select accounts…"
                />
                <div style={{ fontSize: 12, color: (trade.copyTradedAccounts || []).length > 0 ? '#22c55e' : '#fbbf24', marginTop: 5, fontWeight: 600 }}>
                  {(trade.copyTradedAccounts || []).length > 0
                    ? `P&L ×${(trade.copyTradedAccounts || []).length} — summed across ${(trade.copyTradedAccounts || []).length} accounts`
                    : 'Select every account this trade ran on to sum its P&L'}
                </div>
              </div>
            )}
          </div>
          <div>
            {fieldLabel('Session')}
            <select value={(trade.sessions || [])[0] || ''} onChange={e => set('sessions', e.target.value ? [e.target.value] : [])}
              style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              <option value="">—</option>
              {SESSION_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            {fieldLabel('Direction')}
            <select value={trade.side} onChange={e => set('side', e.target.value as 'Long' | 'Short')}
              style={{ ...selectBase, color: trade.side === 'Long' ? '#22c55e' : trade.side === 'Short' ? 'var(--color-loss)' : 'var(--text)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              <option value="">—</option>
              <option value="Long">Long</option>
              <option value="Short">Short</option>
            </select>
          </div>
          <div>
            {fieldLabel('Entry Price')}
            <input type="number" value={trade.entryPrice} onChange={e => set('entryPrice', e.target.value)}
              placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Exit Price')}
            <input type="number" value={trade.exitPrice} onChange={e => set('exitPrice', e.target.value)}
              placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>

          {/* Row 3: Stop Loss (pts) | Take Profit (pts) | Contracts | Fees $ | Result */}
          <div>
            {fieldLabel('Stop Loss (pts)')}
            <input type="number" value={trade.stopLoss} onChange={e => set('stopLoss', e.target.value)}
              placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Take Profit (pts)')}
            <input type="number" value={trade.takeProfit} onChange={e => set('takeProfit', e.target.value)}
              placeholder="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Contracts')}
            <input type="number" value={trade.contracts} onChange={e => set('contracts', e.target.value)}
              placeholder="1" min="0" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Fees $')}
            <input type="number" value={trade.fees} onChange={e => set('fees', e.target.value)}
              placeholder="0.00" min="0" step="0.01" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Result')}
            <select value={trade.result} onChange={e => set('result', e.target.value as TradeResult)}
              style={{ ...selectBase, color: RESULT_COLORS[trade.result] || 'var(--text)', fontWeight: 700 }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Row 4: Net P&L (auto) | R Multiple (auto) | Gross P&L (auto) | Duration | Trade # */}
          <div>
            {fieldLabel('Net P&L')}
            <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 700, color: hasPnl ? netColor : 'var(--text-dim)',
              background: hasPnl ? (netPnl > 0 ? 'var(--color-win-bg)' : netPnl < 0 ? 'var(--color-loss-bg)' : 'var(--bg)') : 'var(--bg)',
              border: `1px solid ${hasPnl ? (netPnl > 0 ? 'var(--color-win-border)' : netPnl < 0 ? 'var(--color-loss-border)' : 'var(--border)') : 'var(--border)'}`,
            }}>
              {hasPnl ? (netPnl >= 0 ? '+' : '') + formatCurrency(netPnl) : '—'}
            </div>
          </div>
          <div>
            {fieldLabel('R Multiple')}
            <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 700, color: rColor,
              background: rMultiple !== null ? (rMultiple >= 0 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)') : 'var(--bg)',
              border: `1px solid ${rMultiple !== null ? (rMultiple >= 0 ? 'var(--color-win-border)' : 'var(--color-loss-border)') : 'var(--border)'}`,
            }}>
              {rMultiple !== null ? `${rMultiple >= 0 ? '+' : ''}${rMultiple}R` : '—'}
            </div>
          </div>
          <div>
            {fieldLabel('Gross P&L')}
            <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 700, color: hasPnl ? grossColor : 'var(--text-dim)',
              background: hasPnl ? (grossPnl > 0 ? 'var(--color-win-bg)' : grossPnl < 0 ? 'var(--color-loss-bg)' : 'var(--bg)') : 'var(--bg)',
              border: `1px solid ${hasPnl ? (grossPnl > 0 ? 'var(--color-win-border)' : grossPnl < 0 ? 'var(--color-loss-border)' : 'var(--border)') : 'var(--border)'}`,
            }}>
              {hasPnl ? (grossPnl >= 0 ? '+' : '') + formatCurrency(grossPnl) : '—'}
            </div>
          </div>
          <div>
            {fieldLabel('Duration')}
            <input value={trade.duration} onChange={e => set('duration', e.target.value)}
              placeholder="e.g. 45m" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>
          <div>
            {fieldLabel('Trade # for Day')}
            <input type="number" value={trade.tradeNumber} onChange={e => set('tradeNumber', e.target.value)}
              placeholder="1" min="1" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
          </div>

          {/* Row 5: Grade */}
          <div>
            {fieldLabel('Grade')}
            <select value={trade.grade || ''} onChange={e => set('grade', e.target.value)}
              style={{ ...selectBase, color: trade.grade ? (GRADE_COLORS[trade.grade] || 'var(--text)') : 'var(--text-muted)', fontWeight: 700 }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
              <option value="">{autoGradeResultInline ? `Auto · ${autoGradeResultInline.grade}` : 'Auto'}</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div /><div /><div /><div />
        </div>

        {/* ── ICT / Trade Context 5×5 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.09em', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>ICT / Trade Context</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 10 : 14 }}>

            {/* Row 1: HTF Bias | Draw on Liquidity | Internal Range Liq | External Range Liq | Liquidity Swept */}
            <div>
              {fieldLabel('HTF Bias')}
              <select value={trade.htfBias || ''} onChange={e => set('htfBias', e.target.value)}
                style={{ ...selectBase, color: trade.htfBias === 'Bullish' ? '#22c55e' : trade.htfBias === 'Bearish' ? 'var(--color-loss)' : 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {HTF_BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              {fieldLabel('Draw on Liquidity')}
              <MultiSelectDropdown
                options={customDols}
                selected={trade.dol || []}
                onChange={next => set('dol', next)}
              />
            </div>
            <div>
              {fieldLabel('Internal Range Liq')}
              <MultiSelectDropdown
                options={TIMEFRAMES.map(tf => `FVG (${tf})`)}
                selected={trade.internalRangeLiquidity || []}
                onChange={next => set('internalRangeLiquidity', next)}
              />
            </div>
            <div>
              {fieldLabel('External Range Liq')}
              <MultiSelectDropdown
                options={(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => `${b} (${tf})`))}
                selected={trade.externalRangeLiquidity || []}
                onChange={next => set('externalRangeLiquidity', next)}
              />
            </div>
            <div>
              {fieldLabel('Liquidity Swept')}
              <MultiSelectDropdown
                options={(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => `${b} (${tf})`))}
                selected={trade.liquiditySwept || []}
                onChange={next => set('liquiditySwept', next)}
              />
            </div>

            {/* Row 2: SMT Present | CISD Present | Displacement | FVG Present | iFVG Present */}
            <div>
              {fieldLabel('SMT Present')}
              <MultiSelectDropdown
                options={TIMEFRAMES.map(tf => `SMT (${tf})`)}
                selected={trade.smtPresent || []}
                onChange={next => set('smtPresent', next)}
              />
            </div>
            <div>
              {fieldLabel('CISD Present')}
              <MultiSelectDropdown
                options={TIMEFRAMES.map(tf => `CISD (${tf})`)}
                selected={trade.cisdPresent || []}
                onChange={next => set('cisdPresent', next)}
              />
            </div>
            <div>
              {fieldLabel('Displacement')}
              <select value={trade.displacement || ''} onChange={e => set('displacement', e.target.value)}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              {fieldLabel('FVG Present')}
              <MultiSelectDropdown
                options={TIMEFRAMES.map(tf => `FVG (${tf})`)}
                selected={trade.fvgPresent || []}
                onChange={next => set('fvgPresent', next)}
              />
            </div>
            <div>
              {fieldLabel('iFVG Present')}
              <MultiSelectDropdown
                options={TIMEFRAMES.map(tf => `iFVG (${tf})`)}
                selected={trade.ifvgPresent || []}
                onChange={next => set('ifvgPresent', next)}
              />
            </div>

            {/* Row 3: Rejection Block | Entry Model | Setup Type | Playbook Used | Timeframe Used */}
            <div>
              {fieldLabel('Rejection Block')}
              <MultiSelectDropdown
                options={TIMEFRAMES.map(tf => `RB (${tf})`)}
                selected={trade.rejectionBlock || []}
                onChange={next => set('rejectionBlock', next)}
              />
            </div>
            <div>
              {fieldLabel('Entry Model')}
              <MultiSelectDropdown
                options={customEntryModels}
                selected={asArray(trade.entryModel)}
                onChange={next => set('entryModel', next)}
              />
            </div>
            <div>
              {fieldLabel('Setup Type')}
              <input value={trade.setupType || ''} onChange={e => set('setupType', e.target.value)}
                placeholder="e.g. Reversal" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {fieldLabel('Playbook Used')}
              <input value={trade.playbookUsed || ''} onChange={e => set('playbookUsed', e.target.value)}
                placeholder="e.g. AM Kill Zone" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {fieldLabel('Timeframe Used')}
              <select value={trade.timeframeExecuted || ''} onChange={e => set('timeframeExecuted', e.target.value)}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>

            {/* Row 4: Market Condition | Exit Reason | Target Logic | Stop Logic | News Present */}
            <div>
              {fieldLabel('Market Condition')}
              <select value={trade.marketCondition || ''} onChange={e => set('marketCondition', e.target.value)}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {MARKET_CONDITIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              {fieldLabel('Exit Reason')}
              <MultiSelectDropdown
                options={EXIT_REASONS}
                selected={trade.exitReason || []}
                onChange={next => set('exitReason', next)}
              />
            </div>
            <div>
              {fieldLabel('Target Logic')}
              <input value={trade.targetLogic || ''} onChange={e => set('targetLogic', e.target.value)}
                placeholder="e.g. Previous HOD" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {fieldLabel('Stop Logic')}
              <input value={trade.riskPlacementLogic || ''} onChange={e => set('riskPlacementLogic', e.target.value)}
                placeholder="e.g. Below OB low" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {fieldLabel('News Present')}
              <select value={trade.newsPresent || ''} onChange={e => set('newsPresent', e.target.value)}
                style={{ ...selectBase, color: trade.newsPresent === 'Yes' ? '#fbbf24' : 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            {/* Row 5: News Impact | Auto Grade | library management | [3 empty] */}
            <div>
              {fieldLabel('News Impact')}
              <select value={trade.newsImpact || ''} onChange={e => set('newsImpact', e.target.value)}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              {fieldLabel('Auto Grade')}
              <div style={{ ...inputBase, display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 18,
                color: autoGradeResultInline ? (GRADE_COLORS[autoGradeResultInline.grade] || 'var(--text)') : 'var(--text-dim)',
                background: 'var(--bg)',
                border: `1px solid ${autoGradeResultInline ? (GRADE_COLORS[autoGradeResultInline.grade] || 'var(--border)') + '44' : 'var(--border)'}`,
                letterSpacing: '-0.02em',
              }}>
                {autoGradeResultInline ? `${autoGradeResultInline.grade} · ${autoGradeResultInline.score}pts` : '—'}
              </div>
            </div>
            <div /><div /><div />
          </div>

          {/* ── Library Management ── */}
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              {fieldLabel('DOL Library')}
              <div style={{ display: 'flex', gap: 5 }}>
                <input value={newDolInput} onChange={e => setNewDolInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDolInline(newDolInput) } }}
                  placeholder="Add DOL to library…"
                  style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                <button onClick={() => addDolInline(newDolInput)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}>+</button>
              </div>
              {customDols.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {customDols.map(d => (
                    <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 13, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
                      {d}
                      <button onClick={() => removeDolFromLibraryInline(d)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-loss)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      ><X size={9} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              {fieldLabel('Entry Model Library')}
              <div style={{ display: 'flex', gap: 5 }}>
                <input value={newEntryModelInput} onChange={e => setNewEntryModelInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEntryModelInline(newEntryModelInput) } }}
                  placeholder="Add entry model to library…"
                  style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                <button onClick={() => addEntryModelInline(newEntryModelInput)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}>+</button>
              </div>
              {customEntryModels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {customEntryModels.map(m => (
                    <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 13, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
                      {m}
                      <button onClick={() => removeEntryModelFromLibraryInline(m)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-loss)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      ><X size={9} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 24 }}>
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

// ── KPI donut ─────────────────────────────────────────────────────────────────

function Donut({ segments, size = 58, thickness = 8 }: { segments: { value: number; color: string }[]; size?: number; thickness?: number }) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
        offset += len
        return el
      })}
    </svg>
  )
}

const kCard: React.CSSProperties = {
  background: 'var(--card-sheen), var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
  padding: '14px 16px', boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 108,
}
const kLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }

// ── Summary Row ───────────────────────────────────────────────────────────────

function SummaryRow({ trade, date, expanded, onToggle, COL, isMobile, unit, selected, onSelect }: {
  trade: TradeLog & { date: string }
  date: string
  expanded: boolean
  onToggle: () => void
  COL: string
  isMobile?: boolean
  unit: Controls['unit']
  selected: boolean
  onSelect: () => void
}) {
  const gross = parseFloat(trade.pnl) || 0
  const fees = parseFloat(trade.fees || '0') || 0
  const net = gross - fees
  const netUnit = tradeUnitValue(trade, unit)
  const pnlColor = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : 'var(--text-muted)'
  const status = net > 0 ? 'WIN' : net < 0 ? 'LOSS' : 'BE'
  const sc = net > 0 ? '#22c55e' : net < 0 ? '#ef4444' : '#8a8a94'
  const entry = parseFloat(trade.entryPrice), contracts = parseFloat(trade.contracts)
  const roi = (!isNaN(entry) && entry > 0 && !isNaN(contracts) && contracts > 0) ? (net / (entry * contracts)) * 100 : null
  const hasR = parseFloat(trade.stopLoss) > 0
  const rMult = hasR ? tradeUnitValue(trade, 'rr') : null
  const dateFmt = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  const numCell: React.CSSProperties = { fontSize: 14, textAlign: 'right', paddingRight: 6 }
  const StatusBadge = (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, width: 'fit-content', letterSpacing: '0.03em', background: `${sc}22`, border: `1px solid ${sc}55`, color: sc }}>{status}</span>
  )

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'grid', gridTemplateColumns: COL, gap: 6,
        padding: isMobile ? '11px 12px' : '11px 26px', alignItems: 'center',
        cursor: 'pointer', transition: 'background 0.1s',
        borderLeft: `2px solid ${expanded ? 'var(--border-strong)' : 'transparent'}`,
        background: expanded ? 'var(--bg-active)' : 'transparent',
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }} onClick={e => { e.stopPropagation(); onSelect() }}>
        <input type="checkbox" checked={selected} readOnly style={{ cursor: 'pointer', width: 15, height: 15 }} />
      </div>
      {isMobile ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{dateFmt}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{trade.symbol || '—'}</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: pnlColor, textAlign: 'right' }}>{trade.pnl ? fmtUnit(netUnit, unit) : '—'}</span>
          {StatusBadge}
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{dateFmt}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{trade.symbol || '—'}</span>
          {StatusBadge}
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{dateFmt}</span>
          <span style={{ ...numCell, color: 'var(--text-sub)' }}>{trade.entryPrice ? formatCurrency(entry) : '—'}</span>
          <span style={{ ...numCell, color: 'var(--text-sub)' }}>{trade.exitPrice ? formatCurrency(parseFloat(trade.exitPrice)) : '—'}</span>
          <span style={{ ...numCell, fontWeight: 700, color: pnlColor }}>{trade.pnl ? fmtUnit(netUnit, unit) : '—'}</span>
          <span style={{ ...numCell, fontWeight: 600, color: roi === null ? 'var(--text-dim)' : roi >= 0 ? '#22c55e' : '#ef4444' }}>{roi === null ? '—' : `${roi >= 0 ? '' : ''}${roi.toFixed(2)}%`}</span>
          <span style={{ ...numCell, fontWeight: 700, color: rMult === null ? 'var(--text-dim)' : rMult >= 0 ? '#22c55e' : '#ef4444' }}>{rMult === null ? '—' : `${rMult >= 0 ? '+' : ''}${rMult.toFixed(2)}R`}</span>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{trade.duration || '—'}</span>
          <span style={{ ...numCell, color: 'var(--text-muted)' }}>{fees ? formatCurrency(fees) : '$0'}</span>
        </>
      )}
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
  const isMobile = useMobile()
  const now = new Date()
  const [search, setSearch] = useState('')
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const unit = controls.unit

  const [showNewModal, setShowNewModal] = useState(false)
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
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

  const accountNames = tradingAccounts.map(a => a.name)
  const symbols = useMemo(() => Array.from(new Set(entries.flatMap(e => e.trades.map(t => t.symbol).filter(Boolean)))).sort(), [entries])

  const filtered = allTrades.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      if (!t.symbol.toLowerCase().includes(q) && !(t.setup || '').toLowerCase().includes(q) && !t.result.toLowerCase().includes(q)) return false
    }
    if (controls.account !== 'all' && !((t.accounts || []).includes(controls.account) || (t.accounts || []).length === 0)) return false
    if (controls.result !== 'all' && t.result !== controls.result) return false
    if (controls.symbol !== 'all' && t.symbol !== controls.symbol) return false
    if (controls.range === 'ytd' && !t.date.startsWith(String(now.getFullYear()))) return false
    if (controls.range === 'month' && !t.date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)) return false
    if (controls.range === '30d') { const c = new Date(); c.setDate(c.getDate() - 30); const cs = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`; if (t.date < cs) return false }
    return true
  })

  // ── KPIs (from filtered) ──
  const netOfT = (t: TradeLog) => (parseFloat(t.pnl) || 0) - (parseFloat(t.fees || '0') || 0)
  const kpi = useMemo(() => {
    const uv = (t: TradeLog) => tradeUnitValue(t, unit)
    const totalNet = filtered.reduce((s, t) => s + uv(t), 0)
    const wins = filtered.filter(t => netOfT(t) > 0)
    const losses = filtered.filter(t => netOfT(t) < 0)
    const bes = filtered.filter(t => netOfT(t) === 0 && t.pnl !== '').length
    const decided = wins.length + losses.length
    const tradeWin = decided > 0 ? (wins.length / decided) * 100 : 0
    const gp = wins.reduce((s, t) => s + netOfT(t), 0)
    const gl = Math.abs(losses.reduce((s, t) => s + netOfT(t), 0))
    const profitFactor = gl === 0 ? (gp > 0 ? Infinity : 0) : gp / gl
    const avgWin = wins.length ? gp / wins.length : 0
    const avgLoss = losses.length ? gl / losses.length : 0
    const wlRatio = avgLoss === 0 ? (avgWin > 0 ? Infinity : 0) : avgWin / avgLoss
    // cumulative (unit) oldest→newest
    const chron = [...filtered].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    let cum = 0
    const cumSeries = [{ i: 0, v: 0 }, ...chron.map((t, i) => { cum += uv(t); return { i: i + 1, v: +cum.toFixed(2) } })]
    return { totalNet, wins: wins.length, losses: losses.length, bes, tradeWin, profitFactor, avgWin, avgLoss, wlRatio, cumSeries, count: filtered.length }
  }, [filtered, unit]) // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleImport(rows: { trade: TradeLog; date: string }[]) {
    const byDate = new Map<string, TradeLog[]>()
    for (const { trade, date } of rows) {
      byDate.set(date, [...(byDate.get(date) || []), trade])
    }
    for (const [date, newTrades] of byDate) {
      const existingEntry = entries.find(e => e.date === date)
      const entry = safeEntry(existingEntry, date)
      entry.trades = [...entry.trades, ...newTrades]
      entry.updatedAt = new Date().toISOString()
      onSave(entry)
    }
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

  const keyOf = (t: TradeLog & { date: string }) => `${t.date}::${t.id}`
  const toggleSelect = (k: string) => setSelected(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const allSelected = filtered.length > 0 && filtered.every(t => selected.has(keyOf(t)))
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(keyOf)))

  function bulkDelete() {
    // group selected by date, remove from each entry
    const byDate = new Map<string, Set<string>>()
    filtered.forEach(t => { const k = keyOf(t); if (selected.has(k)) { const s = byDate.get(t.date) ?? new Set(); s.add(t.id); byDate.set(t.date, s) } })
    byDate.forEach((ids, date) => {
      const existing = entries.find(e => e.date === date)
      if (!existing) return
      const entry = safeEntry(existing, date)
      entry.trades = entry.trades.filter(t => !ids.has(t.id))
      entry.updatedAt = new Date().toISOString()
      if (entry.trades.length === 0) onDelete(date)
      else onSave(entry)
    })
    setSelected(new Set()); setBulkOpen(false)
  }

  const COL = isMobile ? '30px 1fr 1fr 70px' : '34px 0.85fr 0.7fr 0.6fr 0.85fr 0.8fr 0.8fr 0.85fr 0.7fr 0.6fr 0.8fr 0.7fr'

  const hStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 0', whiteSpace: 'nowrap',
  }

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

      {showQuickModal && (
        <QuickAddModal
          initialDate={modalInitialDate}
          onSave={handleModalSave}
          onClose={() => setShowQuickModal(false)}
          tradingAccounts={tradingAccounts}
        />
      )}

      {showImportModal && (
        <ImportTradesModal
          tradingAccounts={tradingAccounts}
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Header + control bar + KPIs */}
      <div style={{ flexShrink: 0, padding: isMobile ? '12px 12px 0' : '18px 26px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tracking</div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Trade View</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ControlBar value={controls} onChange={setControls} accountNames={accountNames} symbols={symbols} />
            <button onClick={() => setShowImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'transparent', color: 'var(--text-sub)', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}><Upload size={13} /> Import</button>
            <button onClick={() => { setModalInitialDate(todayStr()); setShowQuickModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'transparent', color: 'var(--text-sub)', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}><Zap size={13} /> Quick Add</button>
            <button onClick={() => openNew()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--btn-bg)', color: 'var(--btn-text)', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}><Plus size={13} /> New Trade</button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 14 }}>
          <div style={kCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={kLabel}>Net cumulative P&L</span><span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700 }}>{kpi.count}</span></div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.totalNet > 0 ? '#22c55e' : kpi.totalNet < 0 ? '#ef4444' : 'var(--text)', letterSpacing: '-0.02em' }}>{fmtUnit(kpi.totalNet, unit)}</div>
            <div style={{ flex: 1, minHeight: 30 }}>
              <ResponsiveContainer width="100%" height={38}>
                <AreaChart data={kpi.cumSeries} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="tvcum" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={kpi.totalNet >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.4} /><stop offset="100%" stopColor={kpi.totalNet >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.03} /></linearGradient></defs>
                  <Area type="monotone" dataKey="v" stroke={kpi.totalNet >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={1.6} fill="url(#tvcum)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ ...kCard, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><span style={kLabel}>Profit factor</span><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>{kpi.profitFactor === Infinity ? '∞' : kpi.profitFactor.toFixed(2)}</div></div>
            <Donut segments={[{ value: Math.min(kpi.profitFactor === Infinity ? 3 : kpi.profitFactor, 3), color: '#22c55e' }, { value: Math.max(3 - (kpi.profitFactor === Infinity ? 3 : kpi.profitFactor), 0), color: '#ef4444' }]} />
          </div>

          <div style={{ ...kCard, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={kLabel}>Trade win %</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '6px 0' }}>{kpi.tradeWin.toFixed(2)}%</div>
              <div style={{ display: 'flex', gap: 7, fontSize: 12, fontWeight: 700 }}><span style={{ color: '#22c55e' }}>{kpi.wins}</span><span style={{ color: '#3b82f6' }}>{kpi.bes}</span><span style={{ color: '#ef4444' }}>{kpi.losses}</span></div>
            </div>
            <Donut segments={[{ value: kpi.wins, color: '#22c55e' }, { value: kpi.bes, color: '#3b82f6' }, { value: kpi.losses, color: '#ef4444' }]} />
          </div>

          <div style={kCard}>
            <span style={kLabel}>Avg win/loss trade</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{kpi.wlRatio === Infinity ? '∞' : kpi.wlRatio.toFixed(2)}</div>
            <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden', background: 'var(--bg-hover)' }}>
              <div style={{ width: `${(kpi.avgWin / (kpi.avgWin + kpi.avgLoss || 1)) * 100}%`, background: '#22c55e' }} />
              <div style={{ flex: 1, background: '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}><span style={{ color: '#22c55e' }}>${kpi.avgWin.toFixed(1)}</span><span style={{ color: '#ef4444' }}>-${kpi.avgLoss.toFixed(1)}</span></div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '10px 12px' : '14px 26px 12px' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: 360 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trades…"
            style={{ ...inputBase, paddingLeft: 30, fontSize: 14, padding: '7px 12px 7px 30px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-mid)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
        </div>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{selected.size} selected</span>}
        <button title="Table settings" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Settings2 size={16} /></button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => selected.size > 0 && setBulkOpen(o => !o)} disabled={selected.size === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: selected.size > 0 ? 'var(--bg-card)' : 'var(--bg-hover)', color: selected.size > 0 ? 'var(--text-sub)' : 'var(--text-dim)', fontSize: 14, fontWeight: 600, cursor: selected.size > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Bulk actions <ChevronDown size={13} />
          </button>
          {bulkOpen && selected.size > 0 && (
            <>
              <div onClick={() => setBulkOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 5px)', right: 0, zIndex: 40, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: 'var(--shadow-card)', padding: 5, minWidth: 170 }}>
                <button onClick={bulkDelete} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Trash2 size={14} /> Delete {selected.size} trade{selected.size !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: COL, padding: isMobile ? '0 12px' : '0 26px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer', width: 15, height: 15 }} />
        </div>
        {(isMobile ? ['Date / Pair', 'Net P&L', 'Status'] : ['Open date', 'Symbol', 'Status', 'Close date', 'Entry price', 'Exit price', 'Net P&L', 'Net ROI', 'R', 'Duration', 'Commissions']).map(h => (
          <div key={h} style={{ ...hStyle, textAlign: (['Net P&L', 'Net ROI', 'R', 'Commissions', 'Entry price', 'Exit price'].includes(h)) ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
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
                  isMobile={isMobile}
                  unit={unit}
                  selected={selected.has(key)}
                  onSelect={() => toggleSelect(key)}
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
