/** Hairline column guides from the hero reference; purely decorative. They draw in on load. */
export function GridGuides() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 px-[var(--gutter)]">
      <div className="relative mx-auto h-full max-w-page">
        {[0, 25, 50, 75, 100].map((left, i) => (
          <span
            key={left}
            className={`guide-line absolute inset-y-0 w-px bg-line ${left === 25 || left === 75 ? 'hidden lg:block' : ''}`}
            style={{left: `${String(left)}%`, animationDelay: `${String(i * 60)}ms`}}
          />
        ))}
      </div>
    </div>
  )
}
