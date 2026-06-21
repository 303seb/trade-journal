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
      ? 'rgba(74,222,128,0.4)'
      : 'rgba(248,113,113,0.4)'

  return (
    <div
      style={{
        background: '#141414',
        border: '1px solid #1f1f1f',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 14,
        padding: '18px 18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ color: '#333' }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: '#444', marginTop: 5 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}
