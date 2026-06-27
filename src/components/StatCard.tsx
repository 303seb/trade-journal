import { useMobile } from '../hooks/useMobile'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
  icon: React.ReactNode
}

export function StatCard({ label, value, sub, positive, icon }: StatCardProps) {
  const isMobile = useMobile()
  const valueColor =
    positive === null || positive === undefined
      ? 'var(--text)'
      : positive
      ? '#22c55e'
      : '#ef4444'

  const accentColor =
    positive === null || positive === undefined
      ? 'var(--border-mid)'
      : positive
      ? 'rgba(34,197,94,0.5)'
      : 'rgba(239,68,68,0.5)'

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 14,
        padding: isMobile ? '9px 8px 7px' : '18px 18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 4 : 12,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: isMobile ? 9 : 13, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        {!isMobile && <span style={{ color: 'var(--border-strong)' }}>{icon}</span>}
      </div>
      <div>
        <div style={{ fontSize: isMobile ? 14 : 28, fontWeight: 800, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
        {sub && !isMobile && (
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 7 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}
