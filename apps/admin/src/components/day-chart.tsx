export function DayChart({
  days,
  label,
  format
}: {
  days: {day: string; value: number}[]
  label: string
  format: (n: number) => string
}) {
  const max = Math.max(1, ...days.map(d => d.value))
  const total = days.reduce((a, d) => a + d.value, 0)
  const w = 100 / Math.max(1, days.length)
  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={`${label}: total ${format(total)} over ${String(days.length)} days`}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-40 w-full text-accent">
        {days.map((d, i) => {
          const h = (d.value / max) * 36
          return (
            <rect
              key={d.day}
              x={i * w + w * 0.15}
              y={40 - Math.max(h, 0.6)}
              width={w * 0.7}
              height={Math.max(h, 0.6)}
              rx="0.8"
              className={d.value === 0 ? 'fill-card-raised' : 'fill-current'}>
              <title>{`${d.day}: ${format(d.value)}`}</title>
            </rect>
          )
        })}
      </svg>
      <figcaption className="tabular flex justify-between text-[11px] text-muted">
        <span>{days[0]?.day.slice(5)}</span>
        <span>{days.at(-1)?.day.slice(5)}</span>
      </figcaption>
    </figure>
  )
}
