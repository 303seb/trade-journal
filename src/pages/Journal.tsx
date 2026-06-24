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
const TIMEFRAMES = ['1m', '2m', '3m', '4m', '5m', '15m', '30m', '1hr', '4hr', 'Daily']

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
                  style={{ ...selectBase, color: trade.side === 'Long' ? '#22d3ee' : 'var(--color-loss)' }}
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
                    style={{ ...selectBase, color: trade.htfBias === 'Long' ? '#22d3ee' : trade.htfBias === 'Short' ? 'var(--color-loss)' : 'var(--text)' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                  </select>
                </div>
                <div>
                  {fieldLabel('Draw on Liquidity')}
                  <select value={(trade.dol || [])[0] || ''} onChange={e => set('dol', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {customDols.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('Internal Range Liq')}
                  <select value={(trade.internalRangeLiquidity || [])[0] || ''} onChange={e => set('internalRangeLiquidity', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {TIMEFRAMES.map(tf => <option key={tf} value={`FVG (${tf})`}>{`FVG (${tf})`}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('External Range Liq')}
                  <select value={(trade.externalRangeLiquidity || [])[0] || ''} onChange={e => set('externalRangeLiquidity', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => (
                      <option key={`${b}-${tf}`} value={`${b} (${tf})`}>{`${b} (${tf})`}</option>
                    )))}
                  </select>
                </div>
                <div>
                  {fieldLabel('Liquidity Swept')}
                  <select value={(trade.liquiditySwept || [])[0] || ''} onChange={e => set('liquiditySwept', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => (
                      <option key={`${b}-${tf}`} value={`${b} (${tf})`}>{`${b} (${tf})`}</option>
                    )))}
                  </select>
                </div>

                {/* Row 2: SMT Present | CISD Present | Displacement | FVG Present | iFVG Present */}
                <div>
                  {fieldLabel('SMT Present')}
                  <select value={(trade.smtPresent || [])[0] || ''} onChange={e => set('smtPresent', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {TIMEFRAMES.map(tf => <option key={tf} value={`SMT (${tf})`}>{`SMT (${tf})`}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('CISD Present')}
                  <select value={(trade.cisdPresent || [])[0] || ''} onChange={e => set('cisdPresent', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {TIMEFRAMES.map(tf => <option key={tf} value={`CISD (${tf})`}>{`CISD (${tf})`}</option>)}
                  </select>
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
                  <select value={(trade.fvgPresent || [])[0] || ''} onChange={e => set('fvgPresent', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {TIMEFRAMES.map(tf => <option key={tf} value={`FVG (${tf})`}>{`FVG (${tf})`}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('iFVG Present')}
                  <select value={(trade.ifvgPresent || [])[0] || ''} onChange={e => set('ifvgPresent', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {TIMEFRAMES.map(tf => <option key={tf} value={`iFVG (${tf})`}>{`iFVG (${tf})`}</option>)}
                  </select>
                </div>

                {/* Row 3: Rejection Block | Entry Model | Setup Type | Playbook Used | Timeframe Used */}
                <div>
                  {fieldLabel('Rejection Block')}
                  <select value={(trade.rejectionBlock || [])[0] || ''} onChange={e => set('rejectionBlock', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {TIMEFRAMES.map(tf => <option key={tf} value={`RB (${tf})`}>{`RB (${tf})`}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('Entry Model')}
                  <input value={trade.entryModel || ''} onChange={e => set('entryModel', e.target.value)}
                    placeholder="e.g. Silver Bullet" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                </div>
                <div>
                  {fieldLabel('Setup Type')}
                  <input value={trade.setupType || ''} onChange={e => set('setupType', e.target.value)}
                    placeholder="e.g. Reversal" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                </div>
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

                {/* Row 4: Market Condition | Exit Reason | Target Logic | Stop Placement Logic | News Present */}
                <div>
                  {fieldLabel('Market Condition')}
                  <select value={trade.marketCondition || ''} onChange={e => set('marketCondition', e.target.value)}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    <option value="Consolidation">Consolidation</option>
                    <option value="Distribution">Distribution</option>
                  </select>
                </div>
                <div>
                  {fieldLabel('Exit Reason')}
                  <select value={(trade.exitReason || [])[0] || ''} onChange={e => set('exitReason', e.target.value ? [e.target.value] : [])}
                    style={selectBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                    <option value="">—</option>
                    {customExitReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  {fieldLabel('Target Logic')}
                  <input value={trade.targetLogic || ''} onChange={e => set('targetLogic', e.target.value)}
                    placeholder="e.g. Previous HOD" style={inputBase}
                    onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                </div>
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

                {/* Row 5: News Impact | Auto Grade | [3 empty] */}
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
                <div /><div /><div />

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
                  {fieldLabel('Exit Reason Library')}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <input value={newExitReasonInput} onChange={e => setNewExitReasonInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExitReason(newExitReasonInput) } }}
                      placeholder="Add exit reason to library…"
                      style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                    <button onClick={() => addExitReason(newExitReasonInput)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}>+</button>
                  </div>
                  {customExitReasons.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {customExitReasons.map(r => (
                        <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 13, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
                          {r}
                          <button onClick={() => removeExitReasonFromLibrary(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
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

  const grossPnl = parseFloat(trade.pnl) || 0
  const hasPnl = trade.pnl !== ''
  const feesVal = parseFloat(trade.fees || '0') || 0
  const netPnl = grossPnl - feesVal
  const pv = PVMAP[trade.symbol] ?? 0
  const slPts = parseFloat(trade.stopLoss)
  const c = parseFloat(trade.contracts)
  const riskDollars = pv && !isNaN(slPts) && !isNaN(c) && c > 0 && slPts > 0 ? slPts * pv * c : 0
  const rMultiple = riskDollars > 0 && hasPnl ? parseFloat((grossPnl / riskDollars).toFixed(2)) : null
  const grossColor = grossPnl > 0 ? 'var(--color-win)' : grossPnl < 0 ? 'var(--color-loss)' : 'var(--text-dim)'
  const netColor = netPnl > 0 ? 'var(--color-win)' : netPnl < 0 ? 'var(--color-loss)' : 'var(--text-dim)'
  const rColor = rMultiple === null ? 'var(--text-dim)' : rMultiple >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  const autoGradeResultInline = calcSetupGrade(trade)

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

        {/* ── Basic Trade Details 5×5 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>

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
              style={{ ...selectBase, color: trade.side === 'Long' ? '#22d3ee' : trade.side === 'Short' ? 'var(--color-loss)' : 'var(--text)' }}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>

            {/* Row 1: HTF Bias | Draw on Liquidity | Internal Range Liq | External Range Liq | Liquidity Swept */}
            <div>
              {fieldLabel('HTF Bias')}
              <select value={trade.htfBias || ''} onChange={e => set('htfBias', e.target.value)}
                style={{ ...selectBase, color: trade.htfBias === 'Long' ? '#22d3ee' : trade.htfBias === 'Short' ? 'var(--color-loss)' : 'var(--text)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                <option value="Long">Long</option>
                <option value="Short">Short</option>
              </select>
            </div>
            <div>
              {fieldLabel('Draw on Liquidity')}
              <select value={(trade.dol || [])[0] || ''} onChange={e => set('dol', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {customDols.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              {fieldLabel('Internal Range Liq')}
              <select value={(trade.internalRangeLiquidity || [])[0] || ''} onChange={e => set('internalRangeLiquidity', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {TIMEFRAMES.map(tf => <option key={tf} value={`FVG (${tf})`}>{`FVG (${tf})`}</option>)}
              </select>
            </div>
            <div>
              {fieldLabel('External Range Liq')}
              <select value={(trade.externalRangeLiquidity || [])[0] || ''} onChange={e => set('externalRangeLiquidity', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => (
                  <option key={`${b}-${tf}`} value={`${b} (${tf})`}>{`${b} (${tf})`}</option>
                )))}
              </select>
            </div>
            <div>
              {fieldLabel('Liquidity Swept')}
              <select value={(trade.liquiditySwept || [])[0] || ''} onChange={e => set('liquiditySwept', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {(['Swing High', 'Swing Low'] as const).flatMap(b => TIMEFRAMES.map(tf => (
                  <option key={`${b}-${tf}`} value={`${b} (${tf})`}>{`${b} (${tf})`}</option>
                )))}
              </select>
            </div>

            {/* Row 2: SMT Present | CISD Present | Displacement | FVG Present | iFVG Present */}
            <div>
              {fieldLabel('SMT Present')}
              <select value={(trade.smtPresent || [])[0] || ''} onChange={e => set('smtPresent', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {TIMEFRAMES.map(tf => <option key={tf} value={`SMT (${tf})`}>{`SMT (${tf})`}</option>)}
              </select>
            </div>
            <div>
              {fieldLabel('CISD Present')}
              <select value={(trade.cisdPresent || [])[0] || ''} onChange={e => set('cisdPresent', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {TIMEFRAMES.map(tf => <option key={tf} value={`CISD (${tf})`}>{`CISD (${tf})`}</option>)}
              </select>
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
              <select value={(trade.fvgPresent || [])[0] || ''} onChange={e => set('fvgPresent', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {TIMEFRAMES.map(tf => <option key={tf} value={`FVG (${tf})`}>{`FVG (${tf})`}</option>)}
              </select>
            </div>
            <div>
              {fieldLabel('iFVG Present')}
              <select value={(trade.ifvgPresent || [])[0] || ''} onChange={e => set('ifvgPresent', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {TIMEFRAMES.map(tf => <option key={tf} value={`iFVG (${tf})`}>{`iFVG (${tf})`}</option>)}
              </select>
            </div>

            {/* Row 3: Rejection Block | Entry Model | Setup Type | Playbook Used | Timeframe Used */}
            <div>
              {fieldLabel('Rejection Block')}
              <select value={(trade.rejectionBlock || [])[0] || ''} onChange={e => set('rejectionBlock', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {TIMEFRAMES.map(tf => <option key={tf} value={`RB (${tf})`}>{`RB (${tf})`}</option>)}
              </select>
            </div>
            <div>
              {fieldLabel('Entry Model')}
              <input value={trade.entryModel || ''} onChange={e => set('entryModel', e.target.value)}
                placeholder="e.g. Silver Bullet" style={inputBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
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
                <option value="Consolidation">Consolidation</option>
                <option value="Distribution">Distribution</option>
              </select>
            </div>
            <div>
              {fieldLabel('Exit Reason')}
              <select value={(trade.exitReason || [])[0] || ''} onChange={e => set('exitReason', e.target.value ? [e.target.value] : [])}
                style={selectBase} onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {customExitReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
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
              {fieldLabel('Exit Reason Library')}
              <div style={{ display: 'flex', gap: 5 }}>
                <input value={newExitReasonInput} onChange={e => setNewExitReasonInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExitReasonInline(newExitReasonInput) } }}
                  placeholder="Add exit reason to library…"
                  style={{ ...inputBase, fontSize: 14, padding: '7px 10px' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
                <button onClick={() => addExitReasonInline(newExitReasonInput)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-mid)', background: 'transparent', color: 'var(--text-muted)', fontSize: 16, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}>+</button>
              </div>
              {customExitReasons.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {customExitReasons.map(r => (
                    <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px 3px 10px', borderRadius: 999, fontSize: 13, background: 'var(--bg-active)', border: '1px solid var(--border-mid)', color: 'var(--text)' }}>
                      {r}
                      <button onClick={() => removeExitReasonFromLibraryInline(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1, transition: 'color 0.15s' }}
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
