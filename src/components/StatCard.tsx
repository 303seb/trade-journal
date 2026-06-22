interface StatCardProps {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
  icon: React.ReactNode
}

export function StatCard({ label, value, sub, positive, icon }: StatCardProps) {
  const valueColor =
    positive === null || positive === undefined
      ? '#f0f0f0'
      : positive
      ? '#4ade80'
      : '#f87171'

  const accentColor =
    positive === null || positive === undefined
      ? '#2a2a2a'
      : positive
      ? 'rgba(74,222,128,0.5)'
      : 'rgba(248,113,113,0.5)'

  return (
    <div
      style={{
        background: 'linear-gradient(160deg, #161616 0%, #111 100%)',
        border: '1px solid #222',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 14,
        padding: '18px 18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        boxShadow: '0 2px 12px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </span>
        <span style={{ color: '#2a2a2a' }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: '#555', marginTop: 7 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}
