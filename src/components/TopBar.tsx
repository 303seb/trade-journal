import { useState, useRef, useEffect } from 'react'
import { Menu, Bell, User, Sun, Moon, HelpCircle, Users, Settings as SettingsIcon, LogOut, X, TrendingUp } from 'lucide-react'
import type { Page } from './Sidebar'
import type { JournalEntry } from '../types'

// Replace with the real community invite link when you have one.
const COMMUNITY_URL = 'https://discord.gg/'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Notif = { id: string; title: string; body: string }

function buildNotifications(entries: JournalEntry[]): Notif[] {
  const list: Notif[] = [
    { id: 'welcome', title: 'Welcome to Market Element', body: 'Log every trade, review your stats, and sharpen your edge.' },
  ]
  const today = todayStr()
  const todayEntry = entries.find(e => e.date === today)
  if (!todayEntry || todayEntry.trades.length === 0) {
    list.push({ id: `logtoday-${today}`, title: 'Nothing logged today', body: 'Use Quick Add or Import to capture today’s trades.' })
  }
  const total = entries.reduce((s, e) => s + e.trades.length, 0)
  if (total >= 10) {
    const tier = total >= 100 ? 100 : total >= 50 ? 50 : total >= 25 ? 25 : 10
    list.push({ id: `milestone-${tier}`, title: `${total} trades journaled`, body: 'Consistency compounds — keep the streak going.' })
  }
  return list
}

const READ_KEY = 'me_notif_read'
function loadRead(): string[] { try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]') } catch { return [] } }
function saveRead(ids: string[]) { try { localStorage.setItem(READ_KEY, JSON.stringify(ids)) } catch { /* ignore */ } }

const iconBtnBase: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 10, background: 'transparent', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
  cursor: 'pointer', transition: 'all 0.15s', position: 'relative', flexShrink: 0,
}

function MenuRow({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 12px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: danger ? '#ef4444' : 'var(--text-sub)', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'flex', color: danger ? '#ef4444' : 'var(--text-muted)' }}>{icon}</span>
      {label}
    </button>
  )
}

export function TopBar({ onToggleMenu, darkMode, onToggleTheme, onNavigate, onLogout, userEmail, journalEntries }: {
  onToggleMenu: () => void
  darkMode: boolean
  onToggleTheme: () => void
  onNavigate: (page: Page) => void
  onLogout: () => void
  userEmail?: string
  journalEntries: JournalEntry[]
}) {
  const [bellOpen, setBellOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>(() => loadRead())
  const bellRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const notifs = buildNotifications(journalEntries)
  const unread = notifs.filter(n => !readIds.includes(n.id)).length

  useEffect(() => {
    if (!bellOpen && !profileOpen) return
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen, profileOpen])

  const handleBell = () => {
    const next = !bellOpen
    setBellOpen(next)
    setProfileOpen(false)
    if (next && unread > 0) {
      const all = Array.from(new Set([...readIds, ...notifs.map(n => n.id)]))
      setReadIds(all)
      saveRead(all)
    }
  }

  return (
    <>
      <header style={{
        height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', borderBottom: '1px solid var(--border)', background: 'var(--card-sheen), var(--bg-panel)',
        boxShadow: 'var(--shadow-sm)', position: 'relative', zIndex: 50,
      }}>
        {/* Left: hamburger + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <button onClick={onToggleMenu} aria-label="Toggle menu" style={iconBtnBase}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          ><Menu size={21} strokeWidth={2} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-inset-top)' }}>
              <TrendingUp size={16} color="var(--text-sub)" />
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.13em', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              MARKET ELEMENT
            </span>
          </div>
        </div>

        {/* Right: notifications + profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Bell */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button onClick={handleBell} aria-label="Notifications" style={iconBtnBase}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
            >
              <Bell size={19} strokeWidth={2} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: 7, right: 7, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, border: '1.5px solid var(--bg-panel)' }}>{unread}</span>
              )}
            </button>
            {bellOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, maxWidth: 'calc(100vw - 24px)', maxHeight: 420, overflowY: 'auto', background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: 'var(--shadow-card)', zIndex: 60, padding: 6 }}>
                <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notifications</div>
                {notifs.length === 0 ? (
                  <div style={{ padding: '18px 10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>You’re all caught up</div>
                ) : notifs.map(n => (
                  <div key={n.id} style={{ padding: '10px 10px', borderRadius: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{n.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button onClick={() => { setProfileOpen(o => !o); setBellOpen(false) }} aria-label="Profile"
              style={{ ...iconBtnBase, width: 34, height: 34, borderRadius: 999, background: 'var(--bg-hover)', border: '1px solid var(--border-mid)', color: 'var(--text-sub)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-sub)' }}
            ><User size={17} strokeWidth={2} /></button>
            {profileOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 232, background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: 'var(--shadow-card)', zIndex: 60, padding: 6 }}>
                {userEmail && (
                  <div style={{ padding: '8px 12px 10px', fontSize: 13, color: 'var(--text-dim)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>{userEmail}</div>
                )}
                <MenuRow icon={darkMode ? <Sun size={17} /> : <Moon size={17} />} label={darkMode ? 'Light theme' : 'Dark theme'} onClick={() => { onToggleTheme() }} />
                <MenuRow icon={<HelpCircle size={17} />} label="Help" onClick={() => { setHelpOpen(true); setProfileOpen(false) }} />
                <MenuRow icon={<Users size={17} />} label="Join community" onClick={() => { window.open(COMMUNITY_URL, '_blank', 'noopener,noreferrer'); setProfileOpen(false) }} />
                <MenuRow icon={<SettingsIcon size={17} />} label="Settings" onClick={() => { onNavigate('settings'); setProfileOpen(false) }} />
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <MenuRow icon={<LogOut size={17} />} label="Log out" danger onClick={() => { setProfileOpen(false); onLogout() }} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Help modal */}
      {helpOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setHelpOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-sheen), var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <HelpCircle size={17} color="var(--text-sub)" />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Help</span>
              <button onClick={() => setHelpOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 4 }}><X size={17} /></button>
            </div>
            <div style={{ padding: '18px 20px 20px', fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><b style={{ color: 'var(--text)' }}>Logging trades</b> — use <b>Quick Add</b> for a fast entry, <b>New Trade</b> for full detail, or <b>Import</b> to bring in a CSV export from your broker.</div>
              <div><b style={{ color: 'var(--text)' }}>Reviewing</b> — the <b>Analytics</b> tab breaks down performance by confluence, DOL, bias, session and more.</div>
              <div><b style={{ color: 'var(--text)' }}>Menu</b> — use the ☰ button (top left) to show or hide the navigation.</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Need more help? Reach out in the community.</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
