import {notify} from '@/components/toaster'

/** `t` bound to the `common` namespace. */
type CommonTranslate = (key: 'copied' | 'copyFailed', values: {label: string}) => string

/** Copies `text` and tells the admin what was copied ("Email copied") or that the browser refused. */
export async function copyText(text: string, label: string, t: CommonTranslate): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    notify.error(t('copyFailed', {label}))
    return
  }
  notify.ok(t('copied', {label}))
}
