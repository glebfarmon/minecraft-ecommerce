import {renderWithIntl as render} from '@/test/render-with-providers'
import {screen} from '@testing-library/react'
import {createTranslator} from 'next-intl'

import type {Me} from '@shop/shared/access'

import en from '../../../../messages/en.json'
import HomePage from './page'

let mockMe: Me
jest.mock('next-intl/server', () => ({
  getTranslations: (namespace: string) =>
    Promise.resolve(createTranslator({locale: 'en', messages: en, namespace} as never))
}))
jest.mock('@/lib/session', () => ({requireMe: () => Promise.resolve(mockMe)}))
jest.mock('next/navigation', () => ({usePathname: () => '/', useRouter: () => ({push: jest.fn()})}))

const me = (permissions: string[]) =>
  ({
    id: 'u1',
    email: 'support@shop.localhost',
    name: 'Support',
    role: {id: 'r', name: 'SUPPORT'},
    permissions
  }) as unknown as Me

describe('HomePage', () => {
  it('greets a user without order.read with quick links instead of statistics', async () => {
    mockMe = me(['content.write'])
    render(await HomePage())
    expect(screen.getByRole('heading', {level: 1, name: /^Welcome/})).toBeInTheDocument()
    expect(screen.getByRole('link', {name: /Catalog/})).toHaveAttribute('href', '/catalog')
    expect(screen.getByRole('link', {name: /Content/})).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: /Orders/})).toBeNull()
    expect(screen.queryByRole('link', {name: /Home/})).toBeNull()
    expect(screen.queryByRole('region', {name: 'Revenue EUR'})).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
