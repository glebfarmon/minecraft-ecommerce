import {render, screen} from '@testing-library/react'

import {ORDER_STATUSES} from '@shop/shared/orders'

import {formatDelta, formatMoney, formatPercent} from '../lib/format'
import {DayChart} from './day-chart'
import {KpiCard} from './kpi-card'
import {Ring} from './ring'
import {Spark} from './spark'
import {STATUS_TONE, StatusDot} from './status-dot'

describe('data components', () => {
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
        <Ring value={null} label="Conversion" />
      </>
    )
    expect(screen.getByRole('img', {name: 'Paid per day: 0 → 0'})).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Revenue per day.*€12\.00/})).toBeInTheDocument()
    expect(screen.getByRole('img', {name: 'Conversion: —'})).toBeInTheDocument()
    expect(document.querySelector('svg [d*="NaN"]')).toBeNull()
  })
})
