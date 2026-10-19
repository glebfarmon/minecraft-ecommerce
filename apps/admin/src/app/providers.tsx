'use client'

import {makeStore} from '@/lib/api/store'
import {type ReactNode, useState} from 'react'
import {Provider} from 'react-redux'

import {TooltipProvider} from '@shop/ui/tooltip'

export function Providers({children}: {children: ReactNode}) {
  const [store] = useState(makeStore)
  return (
    <Provider store={store}>
      <TooltipProvider>{children}</TooltipProvider>
    </Provider>
  )
}
