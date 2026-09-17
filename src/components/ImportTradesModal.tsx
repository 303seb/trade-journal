import { useState, useMemo, useRef } from 'react'
import { X, Upload, FileText, Check } from 'lucide-react'
import { formatCurrency } from '../utils/stats'
import type { TradeLog, TradingAccount } from '../types'

const PVMAP: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5, GC: 100, MGC: 10 }

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── Parsing helpers ────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

function parseDate(s: string): string | null {
  if (!s) return null
  const t = s.trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/) // US M/D/Y
  if (m) {
    let [, mo, d, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dt = new Date(t)
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  return null
}

// Reduce a futures contract symbol (e.g. "MNQU5", "ESH26") to its root ("MNQ", "ES").
function normalizeSymbol(s: string): string {
  const up = (s || '').trim().toUpperCase().replace(/^[@/]/, '')
  const m = up.match(/^([A-Z0-9]+?)([FGHJKMNQUVXZ]\d{1,2})$/)
  return m ? m[1] : up
}

function normalizeSide(s: string): 'Long' | 'Short' {
  const v = (s || '').trim().toLowerCase()
  if (v.startsWith('s') || v.includes('sell') || v.includes('short')) return 'Short'
  return 'Long'
}

function parseMoney(s: string): number {
  if (!s) return NaN
  let v = s.trim().replace(/[$,\s]/g, '')
  let neg = false
  if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1) }
  const n = parseFloat(v)
  return isNaN(n) ? NaN : (neg ? -n : n)
}

function calcPnl(symbol: string, side: 'Long' | 'Short', entry: string, exit: string, contracts: string): string {
  const pv = PVMAP[symbol]
  const e = parseFloat(entry), x = parseFloat(exit), c = parseFloat(contracts)
  if (!pv || isNaN(e) || isNaN(x) || isNaN(c) || c <= 0 || e === 0 || x === 0) return ''
  return ((side === 'Long' ? x - e : e - x) * pv * c).toFixed(2)
}

function buildTrade(f: {
  symbol: string; account: string; side: 'Long' | 'Short'; entryPrice: string; exitPrice: string
  contracts: string; pnl: string; fees: string; result: TradeLog['result']
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

// ── Column auto-detection ──────────────────────────────────────────────────────

type FieldKey = 'date' | 'symbol' | 'side' | 'contracts' | 'entryPrice' | 'exitPrice' | 'pnl' | 'fees' | 'account'

const FIELDS: { key: FieldKey; label: string; required: boolean }[] = [
  { key: 'date', label: 'Date', required: true },
  { key: 'symbol', label: 'Symbol', required: true },
  { key: 'side', label: 'Direction', required: false },
  { key: 'contracts', label: 'Contracts', required: false },
  { key: 'entryPrice', label: 'Entry Price', required: false },
  { key: 'exitPrice', label: 'Exit Price', required: false },
  { key: 'pnl', label: 'P&L', required: false },
  { key: 'fees', label: 'Fees', required: false },
  { key: 'account', label: 'Account', required: false },
]

const CANDIDATES: Record<FieldKey, string[]> = {
  date: ['date', 'timestamp', 'tradedate', 'boughttimestamp', 'soldtimestamp', 'filltime', 'closetime', 'closedat', 'exittime', 'time'],
  symbol: ['symbol', 'contract', 'instrument', 'product'],
  side: ['side', 'direction', 'bs', 'buysell', 'action', 'longshort', 'position'],
  contracts: ['qty', 'quantity', 'contracts', 'filledqty', 'positionsize', 'numcontracts', 'size'],
  entryPrice: ['entryprice', 'buyprice', 'avgentryprice', 'openprice', 'pricein', 'priceopen', 'entry'],
  exitPrice: ['exitprice', 'sellprice', 'avgexitprice', 'closeprice', 'priceout', 'priceclose', 'exit'],
  pnl: ['pnl', 'pandl', 'realizedpl', 'netpnl', 'grosspnl', 'realizedpnl', 'realizedprofit', 'netprofit', 'profit', 'pl'],
  fees: ['fees', 'commission', 'commissions', 'totalfees', 'totalcommission', 'fee'],
  account: ['account', 'accountname', 'acct', 'accountid', 'accountnickname'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function detectColumn(headers: string[], candidates: string[]): number {
  const H = headers.map(norm)
  for (const c of candidates) { const i = H.indexOf(c); if (i >= 0) return i }
  for (const c of candidates) {
    if (c.length >= 4) { const i = H.findIndex(h => h.includes(c) || c.includes(h)); if (i >= 0) return i }
  }
  return -1
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-mid)', borderRadius: 7,
  padding: '7px 26px 7px 10px', fontSize: 14, color: 'var(--text)', outline: 'none', width: '100%',
  boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23888888' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center',
}

export function ImportTradesModal({ tradingAccounts, onImport, onClose }: {
  tradingAccounts: TradingAccount[]
  onImport: (rows: { trade: TradeLog; date: string }[]) => void
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({} as Record<FieldKey, number>)
  const [defaultAccount, setDefaultAccount] = useState('')
  const [imported, setImported] = useState(0)

  const accountOptions = tradingAccounts.length > 0 ? tradingAccounts.map(a => a.name) : ['Live', 'Funded', 'Eval']

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = typeof e.target?.result === 'string' ? e.target.result : ''
      const rows = parseCSV(text)
      if (rows.length < 2) return
      const hdr = rows[0]
      const auto = {} as Record<FieldKey, number>
      FIELDS.forEach(f => { auto[f.key] = detectColumn(hdr, CANDIDATES[f.key]) })
      setHeaders(hdr)
      setDataRows(rows.slice(1))
      setMapping(auto)
      setFileName(file.name)
    }
    reader.readAsText(file)
  }

  const parsed = useMemo(() => {
    if (dataRows.length === 0) return { trades: [] as { trade: TradeLog; date: string }[], skipped: 0 }
    const get = (row: string[], key: FieldKey) => {
      const idx = mapping[key]
      return idx >= 0 && idx < row.length ? row[idx] : ''
    }
    const trades: { trade: TradeLog; date: string }[] = []
    let skipped = 0
    for (const row of dataRows) {
      const date = parseDate(get(row, 'date'))
      const symbol = normalizeSymbol(get(row, 'symbol'))
      if (!date || !symbol) { skipped++; continue }
      const side = normalizeSide(get(row, 'side'))
      const contracts = (get(row, 'contracts') || '').replace(/[^0-9.]/g, '')
      const entryPrice = (get(row, 'entryPrice') || '').replace(/[^0-9.\-]/g, '')
      const exitPrice = (get(row, 'exitPrice') || '').replace(/[^0-9.\-]/g, '')
      const feesNum = mapping.fees >= 0 ? parseMoney(get(row, 'fees')) : 0
      const fees = isNaN(feesNum) ? '' : String(Math.abs(feesNum))
      let pnl = ''
      if (mapping.pnl >= 0) { const p = parseMoney(get(row, 'pnl')); if (!isNaN(p)) pnl = p.toFixed(2) }
      if (pnl === '') pnl = calcPnl(symbol, side, entryPrice, exitPrice, contracts)
      const account = mapping.account >= 0 ? (get(row, 'account').trim() || defaultAccount) : defaultAccount
      const net = (parseFloat(pnl) || 0) - (isNaN(feesNum) ? 0 : Math.abs(feesNum))
      const result: TradeLog['result'] = net > 0 ? 'Win' : net < 0 ? 'Loss' : 'BE'
      trades.push({ date, trade: buildTrade({ symbol, account, side, entryPrice, exitPrice, contracts, pnl, fees, result }) })
    }
    return { trades, skipped }
  }, [dataRows, mapping, defaultAccount])

  const requiredOk = mapping.date >= 0 && mapping.symbol >= 0
  const canImport = requiredOk && parsed.trades.length > 0 && imported === 0

  const handleImport = () => {
    if (!canImport) return
    onImport(parsed.trades)
    setImported(parsed.trades.length)
    setTimeout(() => onClose(), 900)
  }

  const hasFile = dataRows.length > 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: 'var(--card-sheen), var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Upload size={16} color="var(--text-sub)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Import Trades from CSV</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-sub)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          ><X size={17} /></button>
        </div>

        <div style={{ padding: '18px 20px 20px', overflowY: 'auto' }}>
          {!hasFile ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f) }}
              onDragOver={e => e.preventDefault()}
              style={{ border: '2px dashed var(--border-mid)', borderRadius: 12, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
            >
              <FileText size={26} color="var(--text-muted)" />
              <span style={{ fontSize: 16, color: 'var(--text-sub)', fontWeight: 600 }}>Click or drop your Tradovate CSV export</span>
              <span style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
                Use a completed-trades / performance export (one row per trade). Columns are matched automatically — you can adjust them next.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* File row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                <FileText size={14} />
                <span style={{ color: 'var(--text-sub)', fontWeight: 600 }}>{fileName}</span>
                <span>· {dataRows.length} rows</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => { setDataRows([]); setHeaders([]); setFileName(''); setImported(0) }}
                  style={{ background: 'none', border: '1px solid var(--border-mid)', borderRadius: 7, padding: '5px 10px', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Change file
                </button>
              </div>

              {/* Column mapping */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Match columns</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {FIELDS.map(f => (
                    <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: f.required && mapping[f.key] < 0 ? '#fbbf24' : 'var(--text-sub)', fontWeight: 600, width: 92, flexShrink: 0 }}>
                        {f.label}{f.required ? ' *' : ''}
                      </span>
                      <select value={mapping[f.key]} onChange={e => setMapping(m => ({ ...m, [f.key]: parseInt(e.target.value) }))} style={selectStyle}>
                        <option value={-1}>— none —</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Default account */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 600, width: 92, flexShrink: 0 }}>Account</span>
                <select value={defaultAccount} onChange={e => setDefaultAccount(e.target.value)} style={{ ...selectStyle, maxWidth: 240 }}>
                  <option value="">{mapping.account >= 0 ? 'From file (fallback: none)' : '— none —'}</option>
                  {accountOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{mapping.account >= 0 ? 'used when a row has no account' : 'applied to all imported trades'}</span>
              </div>

              {/* Preview */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Preview · {parsed.trades.length} trade{parsed.trades.length !== 1 ? 's' : ''} ready{parsed.skipped > 0 ? ` · ${parsed.skipped} skipped` : ''}
                </div>
                {!requiredOk ? (
                  <div style={{ fontSize: 14, color: '#fbbf24', padding: '10px 0' }}>Map the Date and Symbol columns to continue.</div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Date', 'Symbol', 'Dir', 'Qty', 'Entry', 'Exit', 'Fees', 'P&L'].map(h => (
                            <th key={h} style={{ padding: '6px 9px', textAlign: h === 'Date' || h === 'Symbol' ? 'left' : 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.trades.slice(0, 8).map(({ trade: t, date }, i) => {
                          const p = parseFloat(t.pnl)
                          return (
                            <tr key={i} style={{ borderBottom: i < 7 ? '1px solid var(--border)' : 'none' }}>
                              <td style={{ padding: '6px 9px', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>{date}</td>
                              <td style={{ padding: '6px 9px', color: 'var(--text)', fontWeight: 600 }}>{t.symbol}</td>
                              <td style={{ padding: '6px 9px', textAlign: 'right', color: t.side === 'Long' ? '#22c55e' : '#ef4444' }}>{t.side === 'Long' ? 'L' : 'S'}</td>
                              <td style={{ padding: '6px 9px', textAlign: 'right', color: 'var(--text-muted)' }}>{t.contracts || '—'}</td>
                              <td style={{ padding: '6px 9px', textAlign: 'right', color: 'var(--text-muted)' }}>{t.entryPrice || '—'}</td>
                              <td style={{ padding: '6px 9px', textAlign: 'right', color: 'var(--text-muted)' }}>{t.exitPrice || '—'}</td>
                              <td style={{ padding: '6px 9px', textAlign: 'right', color: 'var(--text-dim)' }}>{t.fees ? formatCurrency(parseFloat(t.fees)) : '—'}</td>
                              <td style={{ padding: '6px 9px', textAlign: 'right', fontWeight: 700, color: isNaN(p) ? 'var(--text-dim)' : p >= 0 ? '#22c55e' : '#ef4444' }}>{isNaN(p) ? '—' : (p >= 0 ? '+' : '') + formatCurrency(p)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {parsed.trades.length > 8 && (
                      <div style={{ padding: '6px 9px', fontSize: 12, color: 'var(--text-dim)', borderTop: '1px solid var(--border)' }}>+ {parsed.trades.length - 8} more…</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--text-dim)' }}>Trades are added to your journal — you can edit any of them afterward.</div>
            <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleImport} disabled={!canImport}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none',
                background: imported > 0 ? 'rgba(34,197,94,0.15)' : canImport ? '#f0f0f0' : 'var(--bg-hover)',
                color: imported > 0 ? '#22c55e' : canImport ? '#111' : 'var(--text-dim)',
                fontSize: 14, fontWeight: 700, cursor: canImport ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {imported > 0 ? <><Check size={14} /> Imported {imported}</> : `Import ${parsed.trades.length} trade${parsed.trades.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }} />
    </div>
  )
}
