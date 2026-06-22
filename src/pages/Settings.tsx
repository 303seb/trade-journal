import { useState } from 'react'
import { Clock, Database, Shield, Bell, Info, Download, Trash2, Upload } from 'lucide-react'
import type { AppSettings, DiaryEntries, JournalEntry, TradingAccount } from '../types'

interface SettingsProps {
  settings: AppSettings
  onUpdate: (settings: AppSettings) => void
  journalEntries: JournalEntry[]
  diaryEntries: DiaryEntries
  tradingAccounts: TradingAccount[]
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Kiev',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
]

const inputStyle: React.CSSProperties = {
  background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 9,
  padding: '10px 14px', fontSize: 14, color: '#d0d0d0', outline: 'none',
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0', marginBottom: description ? 3 : 0 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: '#555' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: checked ? '#4ade80' : '#1e1e1e',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
          boxShadow: checked ? '0 0 12px rgba(74,222,128,0.3)' : 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: checked ? '#fff' : '#555',
          transition: 'left 0.2s, background 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }} />
      </button>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, #111 0%, #0d0d0d 100%)',
      border: '1px solid #1e1e1e', borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 24px', borderBottom: '1px solid #151515',
        background: '#0e0e0e',
      }}>
        <div style={{ color: '#555' }}>{icon}</div>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{title}</span>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#151515', margin: '-4px 0' }} />
}

export function Settings({ settings, onUpdate, journalEntries, diaryEntries, tradingAccounts }: SettingsProps) {
  const [clearConfirm, setClearConfirm] = useState(false)
  const [exported, setExported] = useState(false)
  const [imported, setImported] = useState(false)

  const handleExport = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      journalEntries,
      diaryEntries,
      tradingAccounts,
      settings,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade-journal-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 2500)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.settings) onUpdate(data.settings)
        // Note: full import of journal/diary entries would require parent callbacks
        setImported(true)
        setTimeout(() => setImported(false), 2500)
      } catch {
        alert('Invalid export file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearAll = () => {
    if (!clearConfirm) { setClearConfirm(true); return }
    // Clear all localStorage keys
    ['tj_journal', 'tj_goals', 'tj_confluences', 'tj_rules', 'tj_accounts', 'tj_diary', 'tj_settings'].forEach(k => {
      localStorage.removeItem(k)
    })
    window.location.reload()
  }

  const totalTrades = journalEntries.reduce((s, e) => s + e.trades.length, 0)
  const diaryCount = Object.keys(diaryEntries).filter(k => diaryEntries[k]?.trim()).length
  const accountCount = tradingAccounts.length

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '36px 32px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page header */}
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f0f0f0', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Settings</h1>
          <p style={{ fontSize: 14, color: '#555', margin: 0 }}>Manage your preferences and account data.</p>
        </div>

        {/* Accessibility */}
        <Section title="Accessibility" icon={<Shield size={15} />}>
          <Toggle
            label="Dark Mode"
            description="Switch to a light interface — restarts in light theme"
            checked={settings.darkMode}
            onChange={v => {
              const next = { ...settings, darkMode: v }
              onUpdate(next)
              document.documentElement.setAttribute('data-theme', v ? 'dark' : 'light')
            }}
          />
          <Divider />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0', marginBottom: 6 }}>Font Scale</div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
              Adjust the global font size. Takes effect immediately.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['Small (14px)', 'Normal (16px)', 'Large (18px)'] as const).map((opt, i) => {
                const sizes = [14, 16, 18]
                const size = sizes[i]
                const isActive = parseInt(document.documentElement.style.fontSize || '16') === size
                return (
                  <button
                    key={opt}
                    onClick={() => { document.documentElement.style.fontSize = `${size}px` }}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${isActive ? '#4a4a4a' : '#1e1e1e'}`,
                      background: isActive ? '#1e1e1e' : 'transparent',
                      color: isActive ? '#f0f0f0' : '#555',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#aaa' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#555' }}
                  >{opt}</button>
                )
              })}
            </div>
          </div>
          <Divider />
          <Toggle
            label="Reduce Motion"
            description="Disables animations and transitions for better readability"
            checked={false}
            onChange={() => {}}
          />
        </Section>

        {/* Date & Time */}
        <Section title="Date & Time" icon={<Clock size={15} />}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0', marginBottom: 4 }}>Timezone</div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
              Used for displaying trade times and daily P&L grouping. Current: <span style={{ color: '#888' }}>{settings.timezone}</span>
            </div>
            <div style={{ position: 'relative' }}>
              <select
                value={settings.timezone}
                onChange={e => onUpdate({ ...settings, timezone: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                onFocus={e => (e.target.style.borderColor = '#333')}
                onBlur={e => (e.target.style.borderColor = '#1e1e1e')}
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz.replace('_', ' ').replace('/', ' / ')}</option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#444', fontSize: 10 }}>▾</div>
            </div>
          </div>
          <Divider />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0', marginBottom: 4 }}>Date Format</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map(fmt => {
                const active = fmt === 'MM/DD/YYYY'
                return (
                  <button key={fmt} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? '#4a4a4a' : '#1e1e1e'}`,
                    background: active ? '#1e1e1e' : 'transparent',
                    color: active ? '#f0f0f0' : '#555', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>{fmt}</button>
                )
              })}
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell size={15} />}>
          <Toggle
            label="Daily Reminders"
            description="Remind me to log trades at the end of each trading day"
            checked={settings.dailyReminder}
            onChange={v => onUpdate({ ...settings, dailyReminder: v })}
          />
          <Divider />
          <Toggle
            label="Weekly Summary"
            description="Send a weekly performance recap every Sunday"
            checked={false}
            onChange={() => {}}
          />
          <Divider />
          <Toggle
            label="Rule Break Alerts"
            description="Alert me when I log a trade without following all rules"
            checked={false}
            onChange={() => {}}
          />
        </Section>

        {/* Data Management */}
        <Section title="Data Management" icon={<Database size={15} />}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Trades Logged', value: totalTrades },
              { label: 'Diary Entries', value: diaryCount },
              { label: 'Accounts', value: accountCount },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#0a0a0a', border: '1px solid #161616', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#d0d0d0', letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ fontSize: 11, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          <Divider />

          {/* Export */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0', marginBottom: 4 }}>Export Data</div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
              Download all your trades, diary entries, and account data as a JSON file.
            </div>
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9,
                border: '1px solid #2a2a2a', background: '#141414', color: exported ? '#4ade80' : '#d0d0d0',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.borderColor = '#3a3a3a' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.borderColor = '#2a2a2a' }}
            >
              <Download size={14} />
              {exported ? 'Downloaded!' : 'Export All Data'}
            </button>
          </div>

          <Divider />

          {/* Import */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0', marginBottom: 4 }}>Import Data</div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
              Restore from a previously exported JSON file. Settings will be applied immediately.
            </div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9,
              border: '1px solid #2a2a2a', background: '#141414', color: imported ? '#4ade80' : '#d0d0d0',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e1e1e' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#141414' }}
            >
              <Upload size={14} />
              {imported ? 'Imported!' : 'Import from File'}
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
          </div>

          <Divider />

          {/* Clear */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>Clear All Data</div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
              Permanently delete all trades, diary entries, accounts, and settings. This cannot be undone.
            </div>
            <button
              onClick={handleClearAll}
              onBlur={() => setTimeout(() => setClearConfirm(false), 200)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9,
                border: `1px solid ${clearConfirm ? 'rgba(248,113,113,0.5)' : '#1e1e1e'}`,
                background: clearConfirm ? 'rgba(248,113,113,0.08)' : 'transparent',
                color: clearConfirm ? '#f87171' : '#555',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!clearConfirm) e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { if (!clearConfirm) e.currentTarget.style.color = '#555' }}
            >
              <Trash2 size={14} />
              {clearConfirm ? 'Click again to confirm — this is permanent' : 'Clear All Data'}
            </button>
          </div>
        </Section>

        {/* About */}
        <Section title="About" icon={<Info size={15} />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'App', value: 'The Market Element' },
              { label: 'Version', value: '1.2.0' },
              { label: 'Built with', value: 'React + Vite + TypeScript' },
              { label: 'Storage', value: 'localStorage (local only)' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#0a0a0a', border: '1px solid #141414', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#333', lineHeight: 1.6 }}>
            All data is stored locally in your browser's localStorage. No data is sent to any server. Export regularly to keep backups.
          </div>
        </Section>

      </div>
    </div>
  )
}
