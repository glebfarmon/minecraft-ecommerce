'use client'

import {useEffect, useState} from 'react'

/** The section being read: the first one (in document order) crossing a band near the top of the viewport. */
export function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const first = ids.find(id => visible.has(id))
        if (first) setActive(first)
      },
      // The band from 20% to 30% of the viewport height, just under the navbar.
      {rootMargin: '-20% 0px -70% 0px'}
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => {
      observer.disconnect()
    }
  }, [ids])

  return active !== undefined && ids.includes(active) ? active : ids[0]
}
