import { LayoutDashboard, ClipboardList, TrendingUp, BarChart2, Newspaper, Wallet, Settings, ChevronLeft, ChevronRight, BookOpen, LogOut } from 'lucide-react'

export type Page = 'dashboard' | 'trades' | 'analytics' | 'news' | 'accounts' | 'diary' | 'settings'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
  onLogout?: () => void
  userEmail?: string
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

export function Sidebar({ page, onNavigate, collapsed, onToggle, onLogout, userEmail }: SidebarProps) {
  return (
    <aside
      style={{
        width: collapsed ? 56 : 270,
        height: '100vh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
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
          justifyContent: 'center', borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={onToggle}
            title="Expand"
            style={{
              width: 32, height: 32, borderRadius: 9, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-dim)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}
          >
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      ) : (
        <div style={{
          flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '24px 16px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)',
        }}>
          {/* Collapse button — top right */}
          <button
            onClick={onToggle}
            title="Collapse"
            style={{
              position: 'absolute', top: 10, right: 10,
              width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-dim)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}
          >
            <ChevronLeft size={15} strokeWidth={1.8} />
          </button>

          {/* Logo */}
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-mid)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
            <TrendingUp size={22} color="var(--text-sub)" />
          </div>

          {/* Title */}
          <span style={{
            fontSize: 17, fontWeight: 700, color: 'var(--text)',
            whiteSpace: 'nowrap', letterSpacing: '0.01em', textAlign: 'center',
          }}>
            The Market Element
          </span>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', overflowY: 'auto' }}>
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
                background: active ? 'var(--bg-active)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                fontSize: 17,
                fontWeight: active ? 700 : 400,
                transition: 'all 0.15s ease',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.3)' : 'none',
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
              <Icon size={17} strokeWidth={active ? 2 : 1.8} />
              {!collapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User / Logout */}
      {onLogout && (
        <div style={{ padding: '10px 8px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {!collapsed && userEmail && (
            <div style={{
              fontSize: 13, color: 'var(--text-dim)', fontWeight: 500,
              padding: '6px 14px 8px', whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {userEmail}
            </div>
          )}
          <button
            onClick={onLogout}
            title={collapsed ? 'Sign Out' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: 12, padding: collapsed ? '12px 0' : '10px 14px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--text-muted)',
              fontSize: 16, fontWeight: 500, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <LogOut size={17} strokeWidth={1.8} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}
    </aside>
  )
}
