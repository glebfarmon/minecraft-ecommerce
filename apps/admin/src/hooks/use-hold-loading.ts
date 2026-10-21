import {useDelayedFlag} from './use-delayed-flag'

/**
 * `loading`, extended so a placeholder that has appeared stays for its minimum time. Render the
 * skeleton while this is true: a load that finishes just after the show delay no longer blinks.
 */
export function useHoldLoading(loading: boolean): boolean {
  const shown = useDelayedFlag(loading)
  return loading || shown
}
