import { useState, useEffect } from 'react'
import { X, Save, Zap } from 'lucide-react'
import { formatCurrency } from '../utils/stats'
import type { TradeLog, TradingAccount } from '../types'

const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }
const SYMBOLS = ['NQ', 'ES', 'GC', 'MNQ', 'MES', 'MGC']

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function calcPnl(symbol: string, side: 'Long' | 'Short', entry: string, exit: string, contracts: string): string {
  const pv = PVMAP[symbol]
  const e = parseFloat(entry), x = parseFloat(exit), c = parseFloat(contracts)
  if (!pv || isNaN(e) || isNaN(x) || isNaN(c) || c <= 0 || e === 0 || x === 0) return ''
  return ((side === 'Long' ? x - e : e - x) * pv * c).toFixed(2)
}

function buildTrade(f: {
  symbol: string; account: string; side: 'Long' | 'Short'; entryPrice: string; exitPrice: string; contracts: string; pnl: string; fees: string; result: TradeLog['result']
}): TradeLog {
  return {
    id: uid(), result: f.result, accounts: f.account ? [f.account] : [],
    symbol: f.symbol, side: f.side, contracts: f.contracts,
    entryPrice: f.entryPrice, exitPrice: f.exitPrice, exitPartials: [], targetPrice: '',
    takeProfit: '', stopLoss: '', pnl: f.pnl, fees: f.fees, drawdown: '',
    duration: '', tradeNumber: '', confluences: [], sessions: [], dol: [],
    setup: '', grade: '', time: '', notes: '',
    htfBias: '', internalRangeLiquidity: [], externalRangeLiquidity: [], liquiditySwept: [],
    smtPresent: [], cisdPresent: [], displacement: '', fvgPresent: [], ifvgPresent: [],
    rejectionBlock: [], entryModel: [], setupType: '', timeframeExecuted: '', marketCondition: '',
    exitReason: [], newsPresent: '', newsType: '', screenshots: [], orderBlock: [], bprPresent: [],
    stdvPresent: [], otePresent: [], propFirm: '', copyTraded: '', copyTradedAccounts: [],
    playbookUsed: '', aplusSetup: '', targetLogic: '', paybackUsed: '', riskPlacementLogic: '',
    ipvdPresent: '', newsImpact: '',
  }
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-mid)', borderRadius: 8,
  padding: '10px 13px', fontSize: 17, color: 'var(--text)', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s', fontFamily: 'inherit', minHeight: 46,
}
const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888888' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 13px center', paddingRight: 36,
}
const label = (t: string) => (
  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{t}</div>
)

export function QuickAddModal({ initialDate, tradingAccounts, onSave, onClose }: {
  initialDate?: string
  tradingAccounts: TradingAccount[]
  onSave: (trade: TradeLog, date: string) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(initialDate || todayStr())
  const [symbol, setSymbol] = useState('')
  const [account, setAccount] = useState('')
  const [side, setSide] = useState<'Long' | 'Short'>('Long')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [contracts, setContracts] = useState('')
  const [fees, setFees] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const accountOptions = tradingAccounts.length > 0 ? tradingAccounts.map(a => a.name) : ['Live', 'Funded', 'Eval']
  const pnl = calcPnl(symbol, side, entryPrice, exitPrice, contracts)
  const hasPnl = pnl !== ''
  const netPnl = (parseFloat(pnl) || 0) - (parseFloat(fees) || 0)
  const result: TradeLog['result'] = netPnl > 0 ? 'Win' : netPnl < 0 ? 'Loss' : 'BE'
  const pnlColor = netPnl > 0 ? '#22c55e' : netPnl < 0 ? '#ef4444' : 'var(--text-dim)'

  const canSave = symbol !== '' && entryPrice !== '' && exitPrice !== '' && contracts !== ''

  function handleSave() {
    if (!canSave) return
    onSave(buildTrade({ symbol, account, side, entryPrice, exitPrice, contracts, pnl, fees, result }), date)
    setSaved(true)
    setTimeout(() => onClose(), 600)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: 'var(--card-sheen), var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <Zap size={16} color="#fbbf24" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Quick Add Trade</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-sub)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          ><X size={17} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {label('Symbol')}
              <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              {label('Account')}
              <select value={account} onChange={e => setAccount(e.target.value)} style={selectStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}>
                <option value="">—</option>
                {accountOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div>
            {label('Direction')}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Long', 'Short'] as const).map(s => (
                <button key={s} onClick={() => setSide(s)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                  border: `1px solid ${side === s ? (s === 'Long' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)') : 'var(--border-mid)'}`,
                  background: side === s ? (s === 'Long' ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)') : 'transparent',
                  color: side === s ? (s === 'Long' ? '#22c55e' : '#ef4444') : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {label('Entry')}
              <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="0" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {label('Exit')}
              <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="0" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {label('Contracts')}
              <input type="number" value={contracts} onChange={e => setContracts(e.target.value)} placeholder="1" min="0" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
            <div>
              {label('Fees $')}
              <input type="number" value={fees} onChange={e => setFees(e.target.value)} placeholder="0.00" min="0" step="0.01" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            </div>
          </div>

          {/* Live net P&L preview */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 10,
            background: hasPnl && netPnl !== 0 ? (netPnl > 0 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)') : 'var(--bg)',
            border: `1px solid ${hasPnl && netPnl !== 0 ? (netPnl > 0 ? 'var(--color-win-border)' : 'var(--color-loss-border)') : 'var(--border)'}` }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net P&L · {hasPnl ? result : '—'}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: pnlColor }}>{hasPnl ? (netPnl >= 0 ? '+' : '') + formatCurrency(netPnl) : '—'}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, minHeight: 42, fontSize: 14, flex: 1 }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-strong)')} onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')} />
            <button onClick={handleSave} disabled={!canSave}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 22px', borderRadius: 8, border: 'none',
                background: saved ? 'rgba(34,197,94,0.15)' : canSave ? '#f0f0f0' : 'var(--bg-hover)',
                color: saved ? '#22c55e' : canSave ? '#111' : 'var(--text-dim)',
                fontSize: 15, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              <Save size={14} />{saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
