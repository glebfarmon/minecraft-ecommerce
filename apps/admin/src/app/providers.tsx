'use client'

import {makeStore} from '@/lib/api/store'
import {type ReactNode, useState} from 'react'
import {Provider} from 'react-redux'

export function Providers({children}: {children: ReactNode}) {
  const [store] = useState(makeStore)
  return <Provider store={store}>{children}</Provider>
}
