import { LayoutDashboard, BookOpen, TrendingUp, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react'

export type Page = 'dashboard' | 'journal' | 'strategies'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
  collapsed: boolean
  onToggle: () => void
}

const NAV: { page: Page; label: string; Icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { page: 'journal',   label: 'Journal',   Icon: BookOpen        },
  { page: 'strategies',label: 'Strategies',Icon: BarChart2       },
]

export function Sidebar({ page, onNavigate, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      style={{
        width: collapsed ? 52 : 210,
        height: '100vh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#090909',
        borderRight: '1px solid #141414',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Header row — collapse button lives here */}
      <div
        style={{
          height: 54,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #141414',
          padding: collapsed ? '0 10px' : '0 12px 0 14px',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        {/* Logo icon (always visible) */}
        {!collapsed && (
          <div
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: '#161616', border: '1px solid #222',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={13} color="#777" />
          </div>
        )}

        {/* Title */}
        {!collapsed && (
          <span
            style={{
              flex: 1, fontSize: 12, fontWeight: 600, color: '#888',
              whiteSpace: 'nowrap', letterSpacing: '0.01em', minWidth: 0,
            }}
          >
            The Market Element
          </span>
        )}

        {/* Toggle arrow — always at top */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#333', cursor: 'pointer', flexShrink: 0,
            transition: 'color 0.15s, background 0.15s',
            marginLeft: collapsed ? 'auto' : undefined,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = '#141414' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = 'transparent' }}
        >
          {collapsed
            ? <ChevronRight size={15} strokeWidth={1.8} />
            : <ChevronLeft size={15} strokeWidth={1.8} />
          }
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
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
                gap: 10,
                padding: collapsed ? '11px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                background: active ? '#141414' : 'transparent',
                color: active ? '#e0e0e0' : '#3a3a3a',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                transition: 'all 0.15s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = '#111'
                  e.currentTarget.style.color = '#777'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#3a3a3a'
                }
              }}
            >
              {/* Active accent bar */}
              {active && (
                <div
                  style={{
                    position: 'absolute', left: 0, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 2, height: 16, borderRadius: 2,
                    background: '#f0f0f0',
                  }}
                />
              )}
              <Icon size={15} strokeWidth={1.8} />
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
