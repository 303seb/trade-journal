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
      ? 'text-[#f0f0f0]'
      : positive
      ? 'text-emerald-400'
      : 'text-red-400'

  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#666] uppercase tracking-wider">{label}</span>
        <div className="text-[#444]">{icon}</div>
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</div>
        {sub && <div className="text-xs text-[#555] mt-1">{sub}</div>}
      </div>
    </div>
  )
}
