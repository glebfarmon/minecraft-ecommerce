'use client'

import {COPIED_FLASH_MS} from '@/config/cart'
import {useTransientFlag} from '@/hooks/use-transient-flag'

export type CopyStatus = 'idle' | 'copied' | 'failed'

/** Writes to the clipboard and reports the outcome for `COPIED_FLASH_MS`. */
export function useCopy() {
  const [copied, flashCopied] = useTransientFlag(COPIED_FLASH_MS)
  const [failed, flashFailed] = useTransientFlag(COPIED_FLASH_MS)
  const copy = (text: string) => {
    // Missing outside secure contexts (plain http on a LAN address).
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (!clipboard) {
      flashFailed()
      return
    }
    clipboard.writeText(text).then(flashCopied, flashFailed)
  }
  const status: CopyStatus = copied ? 'copied' : failed ? 'failed' : 'idle'
  return {status, copy}
}
