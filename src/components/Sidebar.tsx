import { LayoutDashboard, ClipboardList, TrendingUp, BarChart2, Newspaper, Wallet, Settings, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'

export type Page = 'dashboard' | 'trades' | 'analytics' | 'news' | 'accounts' | 'diary' | 'settings'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
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

export function Sidebar({ page, onNavigate, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      style={{
        width: collapsed ? 56 : 270,
        height: '100vh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#090909',
        borderRight: '1px solid #1a1a1a',
        boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Header */}
      {collapsed ? (
        <div style={{
          height: 56, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderBottom: '1px solid #141414',
        }}>
          <button
            onClick={onToggle}
            title="Expand"
            style={{
              width: 32, height: 32, borderRadius: 9, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#333', cursor: 'pointer', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = '#141414' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = 'transparent' }}
          >
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      ) : (
        <div style={{
          flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '24px 16px 20px', borderBottom: '1px solid #141414',
          background: 'linear-gradient(180deg, #111 0%, #090909 100%)',
        }}>
          {/* Collapse button — top right */}
          <button
            onClick={onToggle}
            title="Collapse"
            style={{
              position: 'absolute', top: 10, right: 10,
              width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2a2a2a', cursor: 'pointer', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = '#141414' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#2a2a2a'; e.currentTarget.style.background = 'transparent' }}
          >
            <ChevronLeft size={15} strokeWidth={1.8} />
          </button>

          {/* Logo */}
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: 'linear-gradient(135deg, #1e1e1e 0%, #141414 100%)',
            border: '1px solid #2a2a2a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
            <TrendingUp size={22} color="#888" />
          </div>

          {/* Title */}
          <span style={{
            fontSize: 15, fontWeight: 700, color: '#d0d0d0',
            whiteSpace: 'nowrap', letterSpacing: '0.01em', textAlign: 'center',
          }}>
            The Market Element
          </span>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
        {NAV.map(({ page: p, label, Icon }) => {
          const active = page === p
          return (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              title={collapsed ? label : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '12px 0' : '11px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: active ? '#1a1a1a' : 'transparent',
                color: active ? '#ffffff' : '#666',
                fontSize: 15,
                fontWeight: active ? 700 : 400,
                transition: 'all 0.15s ease',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.3)' : 'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = '#111'
                  e.currentTarget.style.color = '#ccc'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#666'
                }
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3, height: 20, borderRadius: 2,
                  background: 'linear-gradient(180deg, #f0f0f0 0%, #aaa 100%)',
                }} />
              )}
              <Icon size={17} strokeWidth={active ? 2 : 1.8} />
              {!collapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
