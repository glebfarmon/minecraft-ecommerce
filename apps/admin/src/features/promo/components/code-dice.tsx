'use client'

import {Hint} from '@/components/hint'
import {Dices} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'

import {Button} from '@shop/ui/button'

import {CODE_LENGTH, CODE_PLACEHOLDER, generateCode, slotChar} from '../lib/generate-code'

/** One flip of every unsettled slot. */
const FRAME_MS = 40
/** All slots flip together this long before the first one settles. */
const LEAD_MS = 180
/** Then slots settle left to right, one every this many ms (~600 ms in all). */
const STEP_MS = 60

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The dice next to the code input. Like a split-flap board, the code starts from `AAAAA000`,
 * every slot flips through random characters, and the slots settle left to right on the result.
 * `onCode` gets every frame; `done` is true for the last one, the generated code.
 */
export function CodeDice({
  onCode,
  disabled = false,
  random = Math.random
}: {
  onCode: (code: string, done: boolean) => void
  disabled?: boolean
  random?: () => number
}) {
  const t = useTranslations('promo')
  const timer = useRef<number | null>(null)
  const [rolling, setRolling] = useState(false)

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  function roll() {
    stop()
    const code = generateCode(random)
    if (reducedMotion()) {
      onCode(code, true)
      return
    }
    setRolling(true)
    onCode(CODE_PLACEHOLDER, false)
    let elapsed = 0
    timer.current = window.setInterval(() => {
      elapsed += FRAME_MS
      const settled = Math.max(0, Math.floor((elapsed - LEAD_MS) / STEP_MS) + 1)
      if (settled >= CODE_LENGTH) {
        stop()
        setRolling(false)
        onCode(code, true)
        return
      }
      const frame = Array.from({length: CODE_LENGTH}, (_, slot) =>
        slot < settled ? code[slot] : slotChar(slot, random)
      ).join('')
      onCode(frame, false)
    }, FRAME_MS)
  }

  return (
    <Hint label={t('generate')}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('generate')}
        disabled={disabled || rolling}
        className="shrink-0"
        onClick={roll}>
        <Dices aria-hidden className={rolling ? 'size-4 animate-spin' : 'size-4'} />
      </Button>
    </Hint>
  )
}
