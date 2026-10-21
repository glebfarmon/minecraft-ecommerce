import {useHoldLoading} from '@/hooks/use-hold-loading'
import {renderWithIntl as render} from '@/test/render-with-providers'
import {act, screen} from '@testing-library/react'
import {Inbox} from 'lucide-react'

import {Card} from './card'
import {EmptyState} from './empty-state'
import {FormSection} from './form-section'
import {PageHeader} from './page-header'
import {Skeleton} from './skeleton'

describe('layout components', () => {
  it('Card is a named region with an optional action', () => {
    render(
      <Card title="Revenue" action={<button>7d</button>}>
        body
      </Card>
    )
    expect(screen.getByRole('region', {name: 'Revenue'})).toHaveTextContent('body')
    expect(screen.getByRole('button', {name: '7d'})).toBeInTheDocument()
  })

  it('accent Card uses the accent fill', () => {
    render(
      <Card title="Paid" tone="accent">
        1
      </Card>
    )
    expect(screen.getByRole('region', {name: 'Paid'}).className).toMatch(/bg-accent/)
  })

  it('PageHeader renders one h1 and its description', () => {
    render(<PageHeader title="Orders" description="All orders, newest first." />)
    expect(screen.getByRole('heading', {level: 1, name: 'Orders'})).toBeInTheDocument()
    expect(screen.getByText('All orders, newest first.')).toBeInTheDocument()
  })

  it('PageHeader renders the back link before the title', () => {
    render(<PageHeader title="Order" back={{href: '/orders', label: 'Back to orders'}} />)
    const link = screen.getByRole('link', {name: 'Back to orders'})
    const h1 = screen.getByRole('heading', {level: 1})
    expect(link).toHaveAttribute('href', '/orders')
    expect(link.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('EmptyState shows its sentence and action', () => {
    render(<EmptyState icon={Inbox} title="No orders yet." action={<a href="/x">Open shop</a>} />)
    expect(screen.getByText('No orders yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Open shop'})).toBeInTheDocument()
  })

  it('FormSection groups fields under a heading', () => {
    render(
      <FormSection title="Prices">
        <label>
          EUR <input />
        </label>
      </FormSection>
    )
    expect(screen.getByRole('group', {name: 'Prices'})).toContainElement(
      screen.getByLabelText('EUR')
    )
  })
})

function Consumer({loading}: {loading: boolean}) {
  const held = useHoldLoading(loading)
  return held ? (
    <>
      <Skeleton />
      <Skeleton />
    </>
  ) : (
    <p>data</p>
  )
}

describe('skeleton hold', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps the skeleton until 600 ms when the load ends at 250 ms', () => {
    const {container, rerender} = render(<Consumer loading />)
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(container.querySelectorAll('.skeleton')).toHaveLength(2)
    rerender(<Consumer loading={false} />)
    expect(container.querySelectorAll('.skeleton')).toHaveLength(2)
    act(() => {
      jest.advanceTimersByTime(349)
    })
    expect(screen.queryByText('data')).not.toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(screen.getByText('data')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton')).toHaveLength(0)
  })

  // The blocks of a load this fast never show: `.skeleton` fades in only after 200 ms (CSS).
  it('shows data at once when the load ends at 150 ms', () => {
    const {container, rerender} = render(<Consumer loading />)
    act(() => {
      jest.advanceTimersByTime(150)
    })
    rerender(<Consumer loading={false} />)
    expect(screen.getByText('data')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton')).toHaveLength(0)
  })
})
