import {Hint} from '@/components/hint'
import {brandInitial} from '@/lib/brand'
import {getSiteName} from '@/lib/site-name'
import Link from 'next/link'

export async function BrandMark() {
  const name = await getSiteName()
  const full = `${name.plain}${name.accent}`
  return (
    <Hint label={full} side="right">
      <Link
        href="/"
        aria-label={full}
        className="mb-2 flex size-10 items-center justify-center rounded-full bg-accent font-semibold text-on-accent transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none">
        {brandInitial(name)}
      </Link>
    </Hint>
  )
}
