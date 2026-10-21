import {cn} from '@shop/ui/lib/utils'

/**
 * A placeholder of the size of what will be there. Loading states keep their page's own layout
 * and put these where the stored values go; static text and controls stay as they are.
 */
export function Skeleton({className}: {className?: string}) {
  return <div aria-hidden className={cn('skeleton rounded-plate', className)} />
}
