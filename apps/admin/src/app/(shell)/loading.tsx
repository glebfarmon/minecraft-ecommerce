import {SkeletonRows} from '@/components/skeleton'

/**
 * Every shell page renders on request (the session), so without a boundary a click waits for the
 * whole page before anything changes. This fallback is prefetched: the old page goes at once.
 */
export default function ShellLoading() {
  return <SkeletonRows rows={6} />
}
