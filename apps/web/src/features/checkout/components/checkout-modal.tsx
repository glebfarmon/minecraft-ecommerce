'use client'

import {Modal} from '@/components/modal'
import {MorphContent} from '@/components/morph-content'
import {CheckoutForm} from '@/features/checkout/components/checkout-form'
import type {CheckoutInput, CheckoutValues} from '@/features/checkout/schemas'
import {checkoutSchema} from '@/features/checkout/schemas'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useTranslations} from 'next-intl'
import {useId} from 'react'
import {useForm} from 'react-hook-form'

type Props = {
  open: boolean
  /** Shared with the cart panel it grows out of, so the two morph into each other. */
  layoutId: string
  /** Back to the cart panel. */
  onBack: () => void
  /** Close everything. */
  onClose: () => void
}

export function CheckoutModal({open, layoutId, onBack, onClose}: Props) {
  const t = useTranslations('checkout')
  const titleId = useId()
  // Lives here, not in the form: the modal's children unmount on close, and "Back" must not wipe what was typed.
  const form = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: valibotResolver(checkoutSchema),
    mode: 'onTouched',
    defaultValues: {nick: '', email: '', promo: '', delivery: false, terms: false}
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t('close')}
      labelledBy={titleId}
      layoutId={layoutId}
      className="max-w-4xl p-4 md:p-5">
      <MorphContent>
        <CheckoutForm form={form} titleId={titleId} onBack={onBack} />
      </MorphContent>
    </Modal>
  )
}
