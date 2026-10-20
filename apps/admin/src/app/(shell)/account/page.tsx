import {PageHeader} from '@/components/page-header'
import {AccountActions} from '@/features/auth/components/account-actions'
import {useTranslations} from 'next-intl'

export default function AccountPage() {
  const t = useTranslations('auth')
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('account')} />
      <AccountActions />
    </section>
  )
}
