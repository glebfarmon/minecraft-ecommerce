/** Hairline column guides from the hero reference; purely decorative. */
export function GridGuides() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 px-[var(--gutter)]">
      <div className="relative mx-auto h-full max-w-[1440px]">
        {[0, 25, 50, 75, 100].map(left => (
          <span
            key={left}
            className={`absolute inset-y-0 w-px bg-line ${left === 25 || left === 75 ? 'hidden lg:block' : ''}`}
            style={{left: `${String(left)}%`}}
          />
        ))}
      </div>
    </div>
  )
}
