export function Spark({
  values,
  label,
  className
}: {
  values: number[]
  label: string
  className?: string
}) {
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? 100 / (values.length - 1) : 100
  const points = values
    .map((v, i) => `${String(i * step)},${String(30 - (v / max) * 26 - 2)}`)
    .join(' ')
  return (
    <svg
      role="img"
      aria-label={`${label}: ${String(values[0] ?? 0)} → ${String(values.at(-1) ?? 0)}`}
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={className ?? 'h-8 w-24'}>
      <polyline
        points={points}
        pathLength={1}
        className="line-draw"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}
