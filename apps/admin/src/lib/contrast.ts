/** Relative luminance of a `#rrggbb` colour (WCAG 2.2). */
const lum = (hex: string) => {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0)
}

/** WCAG contrast ratio between two `#rrggbb` colours, from 1 (same) to 21 (black on white). */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
