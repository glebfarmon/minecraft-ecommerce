import {formatPercent} from '@/lib/format'

export function Ring({value, label}: {value: number | null; label: string}) {
  const r = 16
  const c = 2 * Math.PI * r
  const filled = value === null ? 0 : Math.min(1, Math.max(0, value)) * c
  return (
    <svg
      role="img"
      aria-label={`${label}: ${formatPercent(value)}`}
      viewBox="0 0 40 40"
      className="size-24">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" className="stroke-card-raised" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${String(filled)} ${String(c)}`}
        transform="rotate(-90 20 20)"
        className="stroke-accent"
      />
      <text x="20" y="22.5" textAnchor="middle" className="fill-fg text-[8px] font-semibold">
        {formatPercent(value)}
      </text>
    </svg>
  )
}
