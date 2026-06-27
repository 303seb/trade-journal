import { LayoutDashboard, ClipboardList, BarChart2, BookOpen, Wallet, Settings } from 'lucide-react'
import type { Page } from './Sidebar'

interface BottomNavProps {
  page: Page
  onNavigate: (page: Page) => void
}

const NAV: { page: Page; label: string; Icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Home',      Icon: LayoutDashboard },
  { page: 'trades',    label: 'Trades',    Icon: ClipboardList   },
  { page: 'analytics', label: 'Analytics', Icon: BarChart2       },
  { page: 'diary',     label: 'Journal',   Icon: BookOpen        },
  { page: 'accounts',  label: 'Accounts',  Icon: Wallet          },
  { page: 'settings',  label: 'Settings',  Icon: Settings        },
]

export function BottomNav({ page, onNavigate }: BottomNavProps) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--bg-panel)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV.map(({ page: p, label, Icon }) => {
        const active = page === p
        return (
          <button
            key={p}
            onClick={() => onNavigate(p)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, padding: '10px 4px 8px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--text)' : 'var(--text-dim)',
              transition: 'color 0.15s',
              position: 'relative',
            }}
          >
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 2, borderRadius: 2, background: 'var(--btn-bg)',
              }} />
            )}
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.02em' }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
