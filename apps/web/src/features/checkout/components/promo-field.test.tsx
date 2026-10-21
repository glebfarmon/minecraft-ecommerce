import {fireEvent, render, screen} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'

import {PromoField} from './promo-field'

jest.mock('next-intl', () => ({useTranslations: () => (key: string) => key}))

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

const setup = (props: Partial<Parameters<typeof PromoField>[0]> = {}) => {
  const onApply = jest.fn()
  const onRemove = jest.fn()
  render(
    <PromoField
      applied={null}
      error={null}
      checking={false}
      onApply={onApply}
      onRemove={onRemove}
      {...props}
    />
  )
  return {onApply, onRemove}
}

const open = () => {
  fireEvent.click(screen.getByRole('button', {name: 'promo.toggle'}))
}

describe('PromoField', () => {
  it('starts collapsed behind a toggle that reveals the input', () => {
    setup()
    expect(screen.queryByLabelText('promo.label')).toBeNull()
    open()
    expect(screen.getByLabelText('promo.label')).toHaveFocus()
    expect(screen.getByRole('button', {name: 'promo.apply'})).toBeDisabled()
  })

  it('applies the trimmed code', () => {
    const {onApply} = setup()
    open()
    fireEvent.change(screen.getByLabelText('promo.label'), {target: {value: '  asf14 '}})
    fireEvent.click(screen.getByRole('button', {name: 'promo.apply'}))
    expect(onApply).toHaveBeenCalledWith('asf14')
  })

  it('applies on Enter without submitting the order form', () => {
    const onSubmit = jest.fn((e: {preventDefault: () => void}) => {
      e.preventDefault()
    })
    const onApply = jest.fn()
    render(
      <form onSubmit={onSubmit}>
        <PromoField
          applied={null}
          error={null}
          checking={false}
          onApply={onApply}
          onRemove={jest.fn()}
        />
      </form>
    )
    open()
    const input = screen.getByLabelText('promo.label')
    fireEvent.change(input, {target: {value: 'ASF14'}})
    fireEvent.keyDown(input, {key: 'Enter'})
    expect(onApply).toHaveBeenCalledWith('ASF14')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps an odd code as typed and never sends more than the input allows', () => {
    const {onApply} = setup()
    open()
    const input = screen.getByLabelText('promo.label')
    expect(input).toHaveAttribute('maxLength', '64')
    fireEvent.change(input, {target: {value: 'ASF-14'}})
    fireEvent.click(screen.getByRole('button', {name: 'promo.apply'}))
    expect(onApply).toHaveBeenCalledWith('ASF-14')
  })

  it('shows an applied code as a chip that removes it', () => {
    const {onRemove} = setup({applied: 'ASF14'})
    expect(screen.queryByLabelText('promo.label')).toBeNull()
    expect(screen.getByText('ASF14')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'promo.remove'}))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('opens itself to show a reason', () => {
    setup({error: 'used_up'})
    expect(screen.getByLabelText('promo.label')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('promo.reasons.used_up')
    expect(screen.getByLabelText('promo.label')).toHaveAttribute('aria-invalid', 'true')
  })

  it('disables Apply while a check runs', () => {
    setup({checking: true})
    open()
    fireEvent.change(screen.getByLabelText('promo.label'), {target: {value: 'ASF14'}})
    expect(screen.getByRole('button', {name: 'promo.apply'})).toBeDisabled()
  })
})
