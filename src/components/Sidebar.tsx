import { LayoutDashboard, ClipboardList, BarChart2, Newspaper, Wallet, Settings, BookOpen } from 'lucide-react'

export type Page = 'dashboard' | 'trades' | 'analytics' | 'news' | 'accounts' | 'diary' | 'settings'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
}

const NAV: { page: Page; label: string; Icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { page: 'trades',    label: 'Trades',    Icon: ClipboardList   },
  { page: 'analytics', label: 'Analytics', Icon: BarChart2       },
  { page: 'diary',     label: 'Daily Journal', Icon: BookOpen     },
  { page: 'news',      label: 'News',      Icon: Newspaper       },
  { page: 'accounts',  label: 'Accounts',  Icon: Wallet          },
  { page: 'settings',  label: 'Settings',  Icon: Settings        },
]

export function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside
      style={{
        width: 250,
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {NAV.map(({ page: p, label, Icon }) => {
          const active = page === p
          return (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                justifyContent: 'flex-start',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--bg-active)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                fontSize: 17,
                fontWeight: active ? 700 : 500,
                transition: 'all 0.15s ease',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.3)' : 'none',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                  e.currentTarget.style.color = 'var(--text-sub)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3, height: 20, borderRadius: 2,
                  background: 'var(--btn-bg)',
                }} />
              )}
              <Icon size={18} strokeWidth={active ? 2 : 1.8} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
