import {PageEnter} from '@/components/page-enter'

import AccountPage from './page'

/** The account page holds no data: it is its own loading state. */
export default function AccountLoading() {
  return (
    <PageEnter>
      <AccountPage />
    </PageEnter>
  )
}
