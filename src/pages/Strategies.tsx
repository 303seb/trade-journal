import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, TrendingUp, TrendingDown, Zap, Trophy, LayoutGrid, Rows3, Settings2,
  MoreVertical, Calendar, Wallet, ChevronDown, X, Share2, FileStack, FlaskConical,
  Archive, ArchiveRestore, Pencil, Trash2,
} from 'lucide-react'
import type { Strategy, JournalEntry, TradingAccount } from '../types'
import { genId } from '../store/useStore'
import { formatCurrency } from '../utils/stats'

interface StrategiesProps {
  strategies: Strategy[]
  journalEntries: JournalEntry[]
  tradingAccounts: TradingAccount[]
  onUpsertStrategy: (s: Strategy) => void
  onDeleteStrategy: (id: string) => void
}

const MAX_STRATEGIES = 10
const PALETTE = ['#a855f7', '#22c55e', '#3b82f6', '#e0a92e', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#8b8b8b']
type RangeKey = 'all' | 'ytd' | 'month' | '30d'
const RANGE_OPTS: { v: RangeKey; l: string }[] = [
  { v: 'all', l: 'All time' }, { v: 'ytd', l: 'This year' }, { v: 'month', l: 'This month' }, { v: '30d', l: 'Last 30 days' },
]
const TEMPLATES = [
  { name: 'ICT Silver Bullet', color: '#e0a92e', description: '10–11am ES/NQ FVG entry after a liquidity sweep.' },
  { name: 'Order Block Reversal', color: '#3b82f6', description: 'Reversal off an HTF order block into a fair value gap.' },
  { name: 'Trend Continuation', color: '#22c55e', description: 'Pullback entries in the direction of the HTF trend.' },
  { name: 'Liquidity Sweep Fade', color: '#ec4899', description: 'Fade the sweep of a session high/low back into range.' },
]

// ── stats helpers ─────────────────────────────────────────────────────────────
interface StratTrade { date: string; net: number; win: boolean; accounts: string[]; terms: string[] }

function tradeTerms(t: JournalEntry['trades'][number]): string[] {
  const raw = [
    ...(t.entryModel || []),
    t.playbookUsed || '', t.setupType || '', t.setup || '',
  ]
  return raw.map(s => s.trim().toLowerCase()).filter(Boolean)
}

function rangeStart(range: RangeKey): number {
  const now = new Date()
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1).getTime()
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  if (range === '30d') return now.getTime() - 30 * 864e5
  return 0
}

interface StratStats {
  trades: number; totalNet: number; avgWin: number; avgLoss: number
  profitFactor: number | null; expectancy: number; winRate: number
}

function computeStats(trades: StratTrade[]): StratStats {
  const n = trades.length
  const winners = trades.filter(t => t.net > 0)
  const losers = trades.filter(t => t.net < 0)
  const totalNet = trades.reduce((s, t) => s + t.net, 0)
  const grossProfit = winners.reduce((s, t) => s + t.net, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.net, 0))
  return {
    trades: n,
    totalNet,
    avgWin: winners.length ? grossProfit / winners.length : 0,
    avgLoss: losers.length ? -grossLoss / losers.length : 0,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : null) : grossProfit / grossLoss,
    expectancy: n ? totalNet / n : 0,
    winRate: n ? (winners.length / n) * 100 : 0,
  }
}

function money(v: number): string { return v === 0 ? '$0' : formatCurrency(v) }
function pf(v: number | null): string { return v === null ? 'N/A' : v === Infinity ? '∞' : v.toFixed(1) }

// ── small dropdown ────────────────────────────────────────────────────────────
function Dropdown({ label, Icon, options, value, onChange }: {
  label: string; Icon: typeof Calendar; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const cur = options.find(o => o.v === value)?.l ?? label
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 9, border: '1px solid var(--border-mid)', background: 'var(--bg-card)', color: 'var(--text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        <Icon size={15} /> {cur} <ChevronDown size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 45, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 11, boxShadow: 'var(--shadow-card)', padding: 6, minWidth: 172 }}>
          {options.map(o => (
            <button key={o.v} onClick={() => { onChange(o.v); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none', background: value === o.v ? 'var(--bg-active)' : 'transparent', color: value === o.v ? 'var(--text)' : 'var(--text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { if (value !== o.v) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (value !== o.v) e.currentTarget.style.background = 'transparent' }}>{o.l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────
type TabKey = 'mine' | 'shared' | 'templates' | 'backtest'

export function Strategies({ strategies, journalEntries, tradingAccounts, onUpsertStrategy, onDeleteStrategy }: StrategiesProps) {
  const [tab, setTab] = useState<TabKey>('mine')
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [range, setRange] = useState<RangeKey>('all')
  const [account, setAccount] = useState('all')
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [creating, setCreating] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)

  const accountNames = useMemo(() => tradingAccounts.map(a => a.name), [tradingAccounts])

  // Flatten trades into strategy-matchable records, filtered by range + account
  const stratTrades = useMemo<StratTrade[]>(() => {
    const start = rangeStart(range)
    const out: StratTrade[] = []
    for (const entry of journalEntries) {
      const t0 = new Date(entry.date + 'T12:00:00').getTime()
      if (t0 < start) continue
      for (const t of entry.trades) {
        const accts = [...(t.accounts || []), ...(t.copyTradedAccounts || [])]
        if (account !== 'all' && !accts.includes(account)) continue
        const net = (parseFloat(t.pnl) || 0) - (parseFloat(t.fees || '0') || 0)
        out.push({ date: entry.date, net, win: net > 0, accounts: accts, terms: tradeTerms(t) })
      }
    }
    return out
  }, [journalEntries, range, account])

  const statsFor = (s: Strategy): StratStats => {
    const terms = (s.matchTerms.length ? s.matchTerms : [s.name]).map(x => x.trim().toLowerCase()).filter(Boolean)
    const matched = stratTrades.filter(t => t.terms.some(tt => terms.includes(tt)))
    return computeStats(matched)
  }

  const rows = useMemo(
    () => strategies.filter(s => (status === 'archived' ? s.archived : !s.archived))
      .map(s => ({ s, stats: statsFor(s) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strategies, status, stratTrades],
  )

  // KPI leaders across active strategies that have trades
  const withTrades = rows.filter(r => r.stats.trades > 0)
  const best = withTrades.slice().sort((a, b) => b.stats.totalNet - a.stats.totalNet)[0]
  const worst = withTrades.slice().sort((a, b) => a.stats.totalNet - b.stats.totalNet)[0]
  const mostActive = withTrades.slice().sort((a, b) => b.stats.trades - a.stats.trades)[0]
  const bestWin = withTrades.slice().sort((a, b) => b.stats.winRate - a.stats.winRate)[0]

  const startCreate = () => { setEditing(null); setCreating(true) }
  const startEdit = (s: Strategy) => { setEditing(s); setCreating(true); setMenuId(null) }
  const toggleArchive = (s: Strategy) => { onUpsertStrategy({ ...s, archived: !s.archived }); setMenuId(null) }
  const remove = (s: Strategy) => { onDeleteStrategy(s.id); setMenuId(null) }

  const addTemplate = (t: typeof TEMPLATES[number]) => {
    if (strategies.length >= MAX_STRATEGIES) return
    onUpsertStrategy({ id: genId(), name: t.name, color: t.color, description: t.description, matchTerms: [t.name], missedTrades: 0, archived: false, createdAt: new Date().toISOString() })
    setTab('mine')
  }

  const TABS: { k: TabKey; label: string; Icon: typeof Share2 }[] = [
    { k: 'mine', label: `My Strategies (${strategies.length}/${MAX_STRATEGIES})`, Icon: FileStack },
    { k: 'shared', label: 'Shared with me', Icon: Share2 },
    { k: 'templates', label: 'Templates', Icon: FileStack },
    { k: 'backtest', label: 'Backtest Scenarios', Icon: FlaskConical },
  ]

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden" style={{ background: 'var(--app-ambient), var(--bg)' }}>
      <div className="mobile-page" style={{ maxWidth: 1500, margin: '0 auto', padding: '22px 26px 40px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8b7ff0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tracking</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 3 }}>Strategies</h1>
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Dropdown label="Date range" Icon={Calendar} value={range} onChange={v => setRange(v as RangeKey)} options={RANGE_OPTS} />
            <Dropdown label="All accounts" Icon={Wallet} value={account} onChange={setAccount}
              options={[{ v: 'all', l: 'All accounts' }, ...accountNames.map(a => ({ v: a, l: a }))]} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 18, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map(({ k, label, Icon }) => {
            const active = tab === k
            return (
              <button key={k} onClick={() => setTab(k)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: active ? 700 : 500, color: active ? '#8b7ff0' : 'var(--text-muted)', borderBottom: active ? '2px solid #8b7ff0' : '2px solid transparent', marginBottom: -1 }}>
                <Icon size={16} /> {label}
              </button>
            )
          })}
        </div>

        {tab === 'mine' ? (
          <>
            {/* Create button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={startCreate} disabled={strategies.length >= MAX_STRATEGIES}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--btn-bg)', color: 'var(--btn-text)', fontSize: 14.5, fontWeight: 700, cursor: strategies.length >= MAX_STRATEGIES ? 'not-allowed' : 'pointer', opacity: strategies.length >= MAX_STRATEGIES ? 0.5 : 1, fontFamily: 'inherit' }}>
                <Plus size={17} /> Create strategy
              </button>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginTop: 16 }}>
              <KpiCard Icon={TrendingUp} tint="#22c55e" label="Best performing strategy" leader={best} metric={best ? `${best.stats.trades} trades` : ''} value={best ? money(best.stats.totalNet) : ''} valueColor="var(--color-win)" />
              <KpiCard Icon={TrendingDown} tint="#ef4444" label="Least performing strategy" leader={worst} metric={worst ? `${worst.stats.trades} trades` : ''} value={worst ? money(worst.stats.totalNet) : ''} valueColor={worst && worst.stats.totalNet < 0 ? 'var(--color-loss)' : 'var(--color-win)'} />
              <KpiCard Icon={Zap} tint="#e0a92e" label="Most active strategy" leader={mostActive} metric={mostActive ? `${mostActive.stats.trades} trades` : ''} />
              <KpiCard Icon={Trophy} tint="#a855f7" label="Best win rate" leader={bestWin} metric={bestWin ? `${bestWin.stats.winRate.toFixed(0)}% / ${bestWin.stats.trades} trades` : ''} />
            </div>

            {/* View controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 20, padding: '12px 0' }}>
              <IconToggle active={view === 'grid'} onClick={() => setView('grid')} Icon={LayoutGrid} />
              <IconToggle active={view === 'list'} onClick={() => setView('list')} Icon={Rows3} />
              <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />
              <IconToggle active={false} onClick={() => {}} Icon={Settings2} />
            </div>

            {/* Active / Archived */}
            <div style={{ display: 'inline-flex', gap: 2, padding: 4, borderRadius: 11, background: 'var(--bg-card)', border: '1px solid var(--border-mid)', marginBottom: 12 }}>
              {(['active', 'archived'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textTransform: 'capitalize', background: status === s ? 'var(--bg-active)' : 'transparent', color: status === s ? 'var(--text)' : 'var(--text-muted)' }}>{s}</button>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyState label={status === 'archived' ? 'No archived strategies' : 'No strategies yet'} sub={status === 'archived' ? 'Archived strategies will appear here.' : 'Create your first strategy to start tracking its performance.'} onCreate={status === 'archived' ? undefined : startCreate} />
            ) : view === 'list' ? (
              <ListTable rows={rows} menuId={menuId} setMenuId={setMenuId} onEdit={startEdit} onArchive={toggleArchive} onRemove={remove} status={status} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {rows.map(({ s, stats }) => (
                  <GridCard key={s.id} s={s} stats={stats} onEdit={() => startEdit(s)} onArchive={() => toggleArchive(s)} onRemove={() => remove(s)} status={status} />
                ))}
              </div>
            )}
          </>
        ) : tab === 'templates' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 22 }}>
            {TEMPLATES.map(t => (
              <div key={t.name} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 15, height: 15, borderRadius: 5, background: t.color }} />
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{t.name}</div>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5, minHeight: 42 }}>{t.description}</div>
                <button onClick={() => addTemplate(t)} disabled={strategies.length >= MAX_STRATEGIES}
                  style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-mid)', background: 'var(--bg-hover)', color: 'var(--text-sub)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: strategies.length >= MAX_STRATEGIES ? 0.5 : 1 }}>
                  <Plus size={15} /> Use template
                </button>
              </div>
            ))}
          </div>
        ) : tab === 'shared' ? (
          <EmptyState label="Nothing shared with you yet" sub="Strategies other traders share with you will show up here." />
        ) : (
          <EmptyState label="No backtest scenarios" sub="Save backtest runs of a strategy to compare them side by side." />
        )}
      </div>

      {creating && (
        <StrategyModal
          initial={editing}
          existingCount={strategies.length}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={s => { onUpsertStrategy(s); setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

// ── sub-components ──────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 14,
  padding: '16px 18px', boxShadow: 'var(--shadow-sm)',
}

function KpiCard({ Icon, tint, label, leader, metric, value, valueColor }: {
  Icon: typeof TrendingUp; tint: string; label: string
  leader?: { s: Strategy } ; metric: string; value?: string; valueColor?: string
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--text-muted)' }}>
        <Icon size={16} color={tint} /> {label}
      </div>
      {leader ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
            <span style={{ width: 17, height: 17, borderRadius: 5, background: leader.s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader.s.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-sub)' }}>{metric}</span>
            {value && <span style={{ fontSize: 14, fontWeight: 800, color: valueColor || 'var(--text)' }}>{value}</span>}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dim)', marginTop: 14 }}>— No data yet</div>
      )}
    </div>
  )
}

function IconToggle({ active, onClick, Icon }: { active: boolean; onClick: () => void; Icon: typeof LayoutGrid }) {
  return (
    <button onClick={onClick}
      style={{ display: 'grid', placeItems: 'center', width: 38, height: 34, borderRadius: 9, border: '1px solid var(--border-mid)', background: active ? 'var(--bg-active)' : 'var(--bg-card)', color: active ? '#8b7ff0' : 'var(--text-muted)', cursor: 'pointer', position: 'relative' }}>
      <Icon size={17} />
      {active && <div style={{ position: 'absolute', bottom: -1, left: 8, right: 8, height: 2, background: '#8b7ff0', borderRadius: 2 }} />}
    </button>
  )
}

const COLS = ['Missed trades', 'Shared strategies', 'Average loser', 'Average winner', 'Total net P&L', 'Profit factor', 'Trades', 'Expectancy']
const GRID = '32px minmax(180px, 1.6fr) repeat(8, 1fr) 44px'

function ListTable({ rows, menuId, setMenuId, onEdit, onArchive, onRemove, status }: {
  rows: { s: Strategy; stats: StratStats }[]
  menuId: string | null; setMenuId: (id: string | null) => void
  onEdit: (s: Strategy) => void; onArchive: (s: Strategy) => void; onRemove: (s: Strategy) => void
  status: 'active' | 'archived'
}) {
  return (
    <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
      <div style={{ minWidth: 1080 }}>
        {/* head */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', placeItems: 'center' }}><span style={{ width: 17, height: 17, border: '2px solid var(--border-strong)', borderRadius: 4 }} /></div>
          <div style={{ ...hCell, textAlign: 'left' }}>Title</div>
          {COLS.map(c => <div key={c} style={hCell}>{c}</div>)}
          <div />
        </div>
        {/* rows */}
        {rows.map(({ s, stats }) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', placeItems: 'center' }}><span style={{ width: 17, height: 17, border: '2px solid var(--border-strong)', borderRadius: 4 }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ width: 15, height: 15, borderRadius: 4, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            </div>
            <div style={dCell}>{s.missedTrades ?? 0}</div>
            <div style={dCell}>-</div>
            <div style={{ ...dCell, color: stats.avgLoss < 0 ? 'var(--color-loss)' : 'var(--text-sub)' }}>{money(stats.avgLoss)}</div>
            <div style={{ ...dCell, color: stats.avgWin > 0 ? 'var(--color-win)' : 'var(--text-sub)' }}>{money(stats.avgWin)}</div>
            <div style={{ ...dCell, fontWeight: 700, color: stats.totalNet > 0 ? 'var(--color-win)' : stats.totalNet < 0 ? 'var(--color-loss)' : 'var(--text-sub)' }}>{money(stats.totalNet)}</div>
            <div style={dCell}>{pf(stats.profitFactor)}</div>
            <div style={dCell}>{stats.trades}</div>
            <div style={{ ...dCell, color: stats.expectancy > 0 ? 'var(--color-win)' : stats.expectancy < 0 ? 'var(--color-loss)' : 'var(--text-sub)' }}>{money(stats.expectancy)}</div>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <button onClick={() => setMenuId(menuId === s.id ? null : s.id)} style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><MoreVertical size={17} /></button>
              {menuId === s.id && <RowMenu s={s} onEdit={onEdit} onArchive={onArchive} onRemove={onRemove} status={status} close={() => setMenuId(null)} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RowMenu({ s, onEdit, onArchive, onRemove, status, close }: {
  s: Strategy; onEdit: (s: Strategy) => void; onArchive: (s: Strategy) => void; onRemove: (s: Strategy) => void
  status: 'active' | 'archived'; close: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [close])
  const item = (Icon: typeof Pencil, label: string, onClick: () => void, danger?: boolean) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', borderRadius: 8, border: 'none', background: 'transparent', color: danger ? '#ef4444' : 'var(--text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      <Icon size={15} /> {label}
    </button>
  )
  return (
    <div ref={ref} style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 45, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 11, boxShadow: 'var(--shadow-card)', padding: 6, minWidth: 168 }}>
      {item(Pencil, 'Edit', () => onEdit(s))}
      {status === 'archived' ? item(ArchiveRestore, 'Unarchive', () => onArchive(s)) : item(Archive, 'Archive', () => onArchive(s))}
      <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
      {item(Trash2, 'Delete', () => onRemove(s), true)}
    </div>
  )
}

function GridCard({ s, stats, onEdit, onArchive, onRemove, status }: {
  s: Strategy; stats: StratStats; onEdit: () => void; onArchive: () => void; onRemove: () => void; status: 'active' | 'archived'
}) {
  const [menu, setMenu] = useState(false)
  const stat = (label: string, val: string, color?: string) => (
    <div><div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{label}</div><div style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text)', marginTop: 2 }}>{val}</div></div>
  )
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 16, height: 16, borderRadius: 5, background: s.color }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenu(m => !m)} style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><MoreVertical size={17} /></button>
          {menu && <RowMenu s={s} onEdit={() => { onEdit(); setMenu(false) }} onArchive={() => { onArchive(); setMenu(false) }} onRemove={() => { onRemove(); setMenu(false) }} status={status} close={() => setMenu(false)} />}
        </div>
      </div>
      {s.description && <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>{s.description}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>
        {stat('Total net P&L', money(stats.totalNet), stats.totalNet > 0 ? 'var(--color-win)' : stats.totalNet < 0 ? 'var(--color-loss)' : undefined)}
        {stat('Trades', String(stats.trades))}
        {stat('Win rate', stats.trades ? `${stats.winRate.toFixed(0)}%` : '—')}
        {stat('Avg winner', money(stats.avgWin), 'var(--color-win)')}
        {stat('Avg loser', money(stats.avgLoss), stats.avgLoss < 0 ? 'var(--color-loss)' : undefined)}
        {stat('Profit factor', pf(stats.profitFactor))}
      </div>
    </div>
  )
}

function EmptyState({ label, sub, onCreate }: { label: string; sub: string; onCreate?: () => void }) {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px', marginTop: 8 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-sub)' }}>{label}</div>
      <div style={{ fontSize: 14.5, color: 'var(--text-dim)', marginTop: 6 }}>{sub}</div>
      {onCreate && (
        <button onClick={onCreate} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'var(--btn-bg)', color: 'var(--btn-text)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={16} /> Create strategy
        </button>
      )}
    </div>
  )
}

// ── create / edit modal ─────────────────────────────────────────────────────────
function StrategyModal({ initial, existingCount, onClose, onSave }: {
  initial: Strategy | null; existingCount: number; onClose: () => void; onSave: (s: Strategy) => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [color, setColor] = useState(initial?.color || PALETTE[existingCount % PALETTE.length])
  const [description, setDescription] = useState(initial?.description || '')
  const [terms, setTerms] = useState((initial?.matchTerms || []).join(', '))
  const [missed, setMissed] = useState(String(initial?.missedTrades ?? 0))

  const save = () => {
    const nm = name.trim()
    if (!nm) return
    const parsedTerms = terms.split(',').map(t => t.trim()).filter(Boolean)
    onSave({
      id: initial?.id || genId(),
      name: nm, color, description: description.trim(),
      matchTerms: parsedTerms.length ? parsedTerms : [nm],
      missedTrades: parseInt(missed) || 0,
      archived: initial?.archived || false,
      createdAt: initial?.createdAt || new Date().toISOString(),
    })
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border-mid)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 16, boxShadow: 'var(--shadow-card)', padding: 22, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{initial ? 'Edit strategy' : 'Create strategy'}</h2>
          <button onClick={onClose} style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Strategy name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Confirmation Model" style={input} autoFocus />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PALETTE.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: 8, background: c, border: color === c ? '3px solid var(--text)' : '2px solid var(--border-mid)', cursor: 'pointer' }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Description <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>(optional)</span></label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What defines this setup?" rows={2} style={{ ...input, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Link to trades tagged</label>
          <input value={terms} onChange={e => setTerms(e.target.value)} placeholder="Confirmation Model, FVG entry" style={input} />
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 5, lineHeight: 1.4 }}>Comma-separated. Trades whose entry model, playbook, or setup match any of these are counted. Defaults to the strategy name.</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={label}>Missed trades</label>
          <input value={missed} onChange={e => setMissed(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ ...input, maxWidth: 120 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-mid)', background: 'var(--bg-card)', color: 'var(--text-sub)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={save} disabled={!name.trim()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--btn-bg)', color: 'var(--btn-text)', fontSize: 14.5, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>{initial ? 'Save changes' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}

const hCell: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'right' }
const dCell: React.CSSProperties = { fontSize: 14.5, fontWeight: 600, color: 'var(--text-sub)', textAlign: 'right' }
