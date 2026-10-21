import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {PromoEditor} from './promo-editor'

const replace = jest.fn()
jest.mock('next/navigation', () => ({useRouter: () => ({replace, push: jest.fn()})}))

const code = {
  id: 'p1',
  code: 'ASF14',
  kind: 'FIXED',
  value: 500,
  currency: 'EUR',
  maxUses: 100,
  usedCount: 3,
  startsAt: '2026-11-01T09:30:00.000Z',
  endsAt: null,
  isActive: true,
  status: 'active',
  locked: false,
  categoryIds: ['c1'],
  productIds: [],
  version: 7,
  createdAt: '2026-10-01T10:00:00.000Z'
}
const categories = [
  {id: 'c1', slug: 'ranks', icon: 'crown', names: {en: 'Ranks', pl: 'Rangi'}},
  {id: 'c2', slug: 'keys', icon: 'box', names: {en: 'Keys', pl: 'Klucze'}}
]
const products = [{id: 'pr1', name: 'VIP', mark: 'VIP', serverId: 's1', categoryId: 'c1'}]

type Write = {method: string; url: string; body: unknown}

function mockApi(promo: object = code, answer: (w: Write) => Response = () => Response.json(code)) {
  const writes: Write[] = []
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    if (req.method !== 'GET') {
      const w = {method: req.method, url: req.url, body: await req.json().catch(() => null)}
      writes.push(w)
      return answer(w)
    }
    if (req.url.includes('/catalog/categories')) return Response.json(categories)
    if (req.url.includes('/catalog/products')) return Response.json(products)
    if (req.url.includes('/catalog/servers')) return Response.json([{id: 's1', name: 'Survival'}])
    return Response.json(promo)
  })
  return writes
}

describe('PromoEditor', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }))
  })

  it('creates a percent code with currency null and the whole shop as scope', async () => {
    const writes = mockApi(code, () => Response.json({...code, id: 'p9'}, {status: 201}))
    const user = userEvent.setup()
    renderWithStore(<PromoEditor />)
    await user.type(screen.getByLabelText('Code'), 'summer25')
    await user.type(screen.getByLabelText('Percent'), '15')
    await user.click(screen.getByRole('button', {name: 'Create code'}))
    await waitFor(() => {
      expect(writes).toHaveLength(1)
    })
    expect(writes[0]?.method).toBe('POST')
    expect(writes[0]?.body).toEqual({
      code: 'SUMMER25',
      kind: 'PERCENT',
      value: 15,
      currency: null,
      maxUses: null,
      startsAt: null,
      endsAt: null,
      isActive: true,
      categoryIds: [],
      productIds: []
    })
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/promo-codes/p9')
    })
  })

  it('fills the code from the dice', async () => {
    mockApi()
    const user = userEvent.setup()
    renderWithStore(<PromoEditor />)
    await user.click(screen.getByRole('button', {name: 'Generate a code'}))
    expect(screen.getByLabelText<HTMLInputElement>('Code').value).toMatch(
      /^[A-HJ-NP-Z]{5}[2-9]{3}$/
    )
  })

  it('refuses a percent outside 1–100', async () => {
    const writes = mockApi()
    const user = userEvent.setup()
    renderWithStore(<PromoEditor />)
    await user.type(screen.getByLabelText('Code'), 'BIG')
    await user.type(screen.getByLabelText('Percent'), '150')
    await user.click(screen.getByRole('button', {name: 'Create code'}))
    expect(await screen.findByText('Use a whole percent from 1 to 100')).toBeInTheDocument()
    expect(writes).toHaveLength(0)
  })

  it('saves a fixed code with its amount in minor units, its currency and the version', async () => {
    const writes = mockApi()
    const user = userEvent.setup()
    renderWithStore(<PromoEditor id="p1" />)
    expect(await screen.findByLabelText('Amount')).toHaveValue('5.00')
    expect(screen.getByLabelText('Ranks')).toBeChecked()
    await user.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => {
      expect(writes).toHaveLength(1)
    })
    expect(writes[0]?.method).toBe('PATCH')
    expect(writes[0]?.body).toEqual({
      code: 'ASF14',
      kind: 'FIXED',
      value: 500,
      currency: 'EUR',
      maxUses: 100,
      startsAt: '2026-11-01T09:30:00.000Z',
      endsAt: null,
      isActive: true,
      categoryIds: ['c1'],
      productIds: [],
      version: 7
    })
  })

  it('disables the locked fields of a used code and says why', async () => {
    mockApi({...code, locked: true})
    renderWithStore(<PromoEditor id="p1" />)
    expect(await screen.findByLabelText('Code')).toBeDisabled()
    expect(
      screen.getByText(
        'This code has been used, so its text, discount and scope are fixed. Create a new code for a different discount.'
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toBeDisabled()
    expect(screen.getByLabelText('Currency')).toBeDisabled()
    expect(screen.getByLabelText('Discount type')).toBeDisabled()
    expect(screen.getByLabelText('Ranks')).toBeDisabled()
    expect(screen.getByRole('button', {name: 'Generate a code'})).toBeDisabled()
    expect(screen.getByLabelText('Max uses')).toBeEnabled()
    expect(screen.getByLabelText('Enabled')).toBeEnabled()
  })

  it('explains a refusal by its code, sending the locked fields unchanged', async () => {
    const writes = mockApi({...code, locked: true}, () =>
      Response.json({message: 'max_uses_below_used'}, {status: 409})
    )
    const user = userEvent.setup()
    renderWithStore(<PromoEditor id="p1" />)
    const max = await screen.findByLabelText('Max uses')
    fireEvent.change(max, {target: {value: '2'}})
    await user.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Max uses cannot be below the times the code was already used.'
    )
    expect(writes[0]?.body).toMatchObject({code: 'ASF14', kind: 'FIXED', value: 500, maxUses: 2})
  })
})
