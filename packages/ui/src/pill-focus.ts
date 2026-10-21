/**
 * Keyboard focus of a control whose selection is a rolling pill. The ring is an `::after` layer
 * above the pill (z-10) and outside it, so it shows on the active item and on any ground. Never the
 * accent (it would fight the pill). The control needs `relative isolate`.
 */
export const PILL_FOCUS =
  "focus-visible:outline-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:z-10 focus-visible:after:rounded-full focus-visible:after:ring-2 focus-visible:after:ring-fg/40 focus-visible:after:content-['']"
