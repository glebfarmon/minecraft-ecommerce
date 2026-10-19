import {render, screen, waitFor} from '@testing-library/react'

import {ORDER_STATUSES} from '@shop/shared/orders'

import {formatDelta, formatMoney, formatPercent} from '../lib/format'
import {DayChart} from './day-chart'
import {KpiCard} from './kpi-card'
import {Spark} from './spark'
import {StatusDonut} from './status-donut'
import {STATUS_TONE, StatusDot} from './status-dot'

describe('data components', () => {
  it('KpiCard with count keeps the real value readable and counts up the visible one', async () => {
    render(
      <KpiCard
        label="Revenue"
        value="€12.34"
        count={{to: 1234, format: n => formatMoney(n, 'EUR')}}
      />
    )
    // Screen readers and text queries get the settled value at once.
    expect(screen.getByText('€12.34')).toBeInTheDocument()
    const shown = document.querySelector('[data-count]') as HTMLElement
    expect(shown).toHaveAttribute('aria-hidden', 'true')
    await screen.findByText('€12.34')
    await waitFor(() => {
      expect(shown).toHaveAttribute('data-count', '€12.34')
    })
  })

  it('StatusDot labels every order status in words and maps a tone', () => {
    for (const s of ORDER_STATUSES) {
      const {unmount} = render(<StatusDot status={s} />)
      expect(
        screen.getByText(/^(Paid|Delivered|Pending|Expired|Refunded|Disputed)$/)
      ).toBeInTheDocument()
      expect(['ok', 'warn', 'bad', 'idle']).toContain(STATUS_TONE[s])
      unmount()
    }
    expect(STATUS_TONE.DISPUTED).toBe('bad')
    expect(STATUS_TONE.PENDING).toBe('warn')
  })

  it('KpiCard shows value and signed delta, hides a null delta', () => {
    const {rerender} = render(<KpiCard label="Paid orders" value="12" delta={0.25} />)
    expect(screen.getByRole('region', {name: 'Paid orders'})).toHaveTextContent('12')
    expect(screen.getByText('+25%')).toBeInTheDocument()
    rerender(<KpiCard label="Paid orders" value="12" delta={-0.1} />)
    expect(screen.getByText('−10%')).toBeInTheDocument()
    rerender(<KpiCard label="Paid orders" value="12" delta={null} />)
    expect(screen.queryByText(/%$/)).toBeNull()
  })

  it('formats money, empty percent and zero delta', () => {
    expect(formatMoney(0, 'EUR')).toBe('€0.00')
    expect(formatMoney(1999, 'PLN')).toMatch(/19\.99/)
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(1 / 3)).toBe('33%')
    expect(formatDelta(0)).toBe('0%')
  })

  it('charts expose a text alternative and survive all-zero data', () => {
    render(
      <>
        <Spark values={[0, 0, 0]} label="Paid per day" />
        <DayChart
          label="Revenue per day"
          format={n => formatMoney(n, 'EUR')}
          days={[
            {day: '2026-10-16', value: 0},
            {day: '2026-10-17', value: 1200}
          ]}
        />
        <StatusDonut counts={[]} />
      </>
    )
    expect(screen.getByRole('img', {name: 'Paid per day: 0 → 0'})).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Revenue per day.*€12\.00/})).toBeInTheDocument()
    expect(screen.getByRole('img', {name: 'Orders by status: none'})).toBeInTheDocument()
    expect(document.querySelector('svg [d*="NaN"]')).toBeNull()
  })

  it('splits the status donut by count and names every status', () => {
    render(
      <StatusDonut
        counts={[
          {status: 'PAID', count: 3},
          {status: 'PENDING', count: 1},
          {status: 'EXPIRED', count: 0}
        ]}
      />
    )
    const donut = screen.getByRole('img', {name: 'Orders by status: Paid 3, Pending 1'})
    expect(donut.querySelectorAll('circle')).toHaveLength(3) // track + 2 segments
    expect(donut).toHaveTextContent('4')
  })
})
