'use client'

import {EASE} from '@/config/motion'
import {RULES_REVEAL} from '@/config/rules'
import {titleWords} from '@/features/rules/lib/title-words'
import {rise} from '@/lib/rise'
import {CalendarDays} from 'lucide-react'
import {MotionConfig, motion} from 'motion/react'

/**
 * The rules page title enters like the home hero: each word slides up from under its own mask, then
 * the lead and the edition rise in. Reduced motion keeps the fades and drops the movement.
 */
export function RulesHeader({
  title,
  lead,
  edition
}: {
  /** The raw message, e.g. `Server <accent>rules</accent>`. */
  title: string
  lead: string
  edition: string | null
}) {
  const words = titleWords(title)
  return (
    <MotionConfig reducedMotion="user">
      <header className="max-w-3xl">
        <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-none font-bold tracking-tight uppercase">
          {words.map((word, i) => (
            <span key={`${word.text}-${String(i)}`}>
              {i > 0 && ' '}
              {/* The mask's em padding keeps tight leading from clipping the glyphs. */}
              <span className="-my-[0.12em] inline-block overflow-hidden py-[0.12em] align-bottom">
                <motion.span
                  className={`inline-block ${word.accent ? 'text-accent' : ''}`}
                  initial={{y: '110%'}}
                  animate={{y: 0}}
                  transition={{
                    duration: 0.7,
                    ease: EASE,
                    delay: RULES_REVEAL.word + i * RULES_REVEAL.wordStep
                  }}>
                  {word.text}
                </motion.span>
              </span>
            </span>
          ))}
        </h1>
        <motion.p {...rise(RULES_REVEAL.lead)} className="mt-6 text-lg text-muted">
          {lead}
        </motion.p>
        {edition && (
          <motion.p
            {...rise(RULES_REVEAL.edition)}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted">
            <CalendarDays aria-hidden className="size-4 text-accent" />
            {edition}
          </motion.p>
        )}
      </header>
    </MotionConfig>
  )
}
