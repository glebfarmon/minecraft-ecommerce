import {PageHeader} from '@/components/page-header'
import {AccountActions} from '@/features/auth/components/account-actions'

export default function AccountPage() {
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title="Account" />
      <AccountActions />
    </section>
  )
}
