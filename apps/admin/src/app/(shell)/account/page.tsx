import {AccountActions} from '@/features/auth/components/account-actions'

export default function AccountPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountActions />
    </section>
  )
}
