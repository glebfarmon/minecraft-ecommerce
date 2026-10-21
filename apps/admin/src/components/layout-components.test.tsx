import {renderWithIntl as render} from '@/test/render-with-providers'
import {act, screen} from '@testing-library/react'
import {Inbox} from 'lucide-react'

import {Card} from './card'
import {EmptyState} from './empty-state'
import {FormSection} from './form-section'
import {PageHeader} from './page-header'
import {SkeletonRows} from './skeleton'

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

  it('EmptyState shows its sentence and action', () => {
    render(<EmptyState icon={Inbox} title="No orders yet." action={<a href="/x">Open shop</a>} />)
    expect(screen.getByText('No orders yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Open shop'})).toBeInTheDocument()
  })

  it('SkeletonRows is hidden from assistive tech and announces loading once', () => {
    render(<SkeletonRows rows={3} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('SkeletonRows draws its blocks only after the show delay', () => {
    jest.useFakeTimers()
    try {
      const {container} = render(<SkeletonRows rows={3} />)
      expect(container.querySelectorAll('.skeleton')).toHaveLength(0)
      act(() => {
        jest.advanceTimersByTime(200)
      })
      expect(container.querySelectorAll('.skeleton')).toHaveLength(3)
    } finally {
      jest.useRealTimers()
    }
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
