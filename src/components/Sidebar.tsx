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
        width: collapsed ? 56 : 270,
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
            background: '#161616', border: '1px solid #222',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                background: active ? '#141414' : 'transparent',
                color: active ? '#e0e0e0' : '#3a3a3a',
                fontSize: 15,
                fontWeight: active ? 600 : 400,
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
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 2, height: 18, borderRadius: 2,
                  background: '#f0f0f0',
                }} />
              )}
              <Icon size={17} strokeWidth={1.8} />
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
