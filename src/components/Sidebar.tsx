import { useState } from 'react'
import {
  Home, BookOpen, ChevronRight, LayoutDashboard, CalendarDays, ClipboardList,
  NotebookPen, BarChart2, Target, LineChart, Library,
} from 'lucide-react'

export type Page =
  | 'home' | 'dashboard' | 'trades' | 'analytics' | 'diary'
  | 'notebook' | 'strategies' | 'progress' | 'resources'
  | 'news' | 'accounts' | 'settings'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
}

const SUBMENU: { page: Page; label: string; Icon: typeof Home }[] = [
  { page: 'dashboard',  label: 'Dashboard',        Icon: LayoutDashboard },
  { page: 'diary',      label: 'Day View',         Icon: CalendarDays    },
  { page: 'trades',     label: 'Trade View',       Icon: ClipboardList   },
  { page: 'notebook',   label: 'Notebook',         Icon: NotebookPen     },
  { page: 'analytics',  label: 'Reports',          Icon: BarChart2       },
  { page: 'strategies', label: 'Strategies',       Icon: Target          },
  { page: 'progress',   label: 'Progress Tracker', Icon: LineChart       },
  { page: 'resources',  label: 'Resources',        Icon: Library         },
]

const JOURNAL_PAGES = SUBMENU.map(s => s.page)

export function Sidebar({ page, onNavigate }: SidebarProps) {
  const inJournal = JOURNAL_PAGES.includes(page)
  const [journalOpen, setJournalOpen] = useState(inJournal)

  const primaryBtn = (active: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 11,
    padding: '12px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-active)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    fontSize: 16, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
    transition: 'all 0.15s ease', position: 'relative', textAlign: 'left',
    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.3)' : 'none',
  })

  return (
    <aside style={{ height: '100%', flexShrink: 0, display: 'flex', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)', boxShadow: '4px 0 24px rgba(0,0,0,0.4)', zIndex: 10 }}>

      {/* Primary rail */}
      <div style={{ width: 138, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: '14px 10px', overflowY: 'auto' }}>
        <button
          onClick={() => { onNavigate('home'); setJournalOpen(false) }}
          style={primaryBtn(page === 'home')}
          onMouseEnter={e => { if (page !== 'home') { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-sub)' } }}
          onMouseLeave={e => { if (page !== 'home') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
        >
          <Home size={18} strokeWidth={page === 'home' ? 2 : 1.8} />
          <span>Home</span>
        </button>

        <button
          onClick={() => setJournalOpen(o => !o)}
          style={primaryBtn(inJournal || journalOpen)}
          onMouseEnter={e => { if (!(inJournal || journalOpen)) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-sub)' } }}
          onMouseLeave={e => { if (!(inJournal || journalOpen)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
        >
          <BookOpen size={18} strokeWidth={inJournal || journalOpen ? 2 : 1.8} />
          <span style={{ flex: 1 }}>Journal</span>
          <ChevronRight size={15} style={{ transition: 'transform 0.2s', transform: journalOpen ? 'rotate(90deg)' : 'none', opacity: 0.7 }} />
        </button>
      </div>

      {/* Journal submenu — extends out beside the primary rail */}
      {journalOpen && (
        <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '14px 10px', borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '2px 12px 10px' }}>Journal</div>
          {SUBMENU.map(({ page: p, label, Icon }) => {
            const active = page === p
            return (
              <button
                key={p}
                onClick={() => onNavigate(p)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--bg-active)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: 15, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                  transition: 'all 0.15s ease', position: 'relative', textAlign: 'left', marginBottom: 2,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-sub)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
              >
                {active && (
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: 2, background: 'var(--btn-bg)' }} />
                )}
                <Icon size={16} strokeWidth={active ? 2 : 1.8} />
                <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}
