interface Props {
  label: string
  value: string
  icon: React.ReactNode
}

export function FantasyMetricCard({ label, value, icon }: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex items-center justify-between text-zinc-500">
        <span className="text-xs font-semibold uppercase tracking-[0.2em]">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  )
}
