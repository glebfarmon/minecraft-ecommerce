import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {useState} from 'react'

import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

const ROLES = [
  {value: 'ADMIN', label: 'ADMIN'},
  {value: 'SUPPORT', label: 'SUPPORT'},
  {value: 'VIEWER', label: 'VIEWER'}
]

function Field({onChange = jest.fn(), initial = ''}: {onChange?: jest.Mock; initial?: string}) {
  const [v, setV] = useState(initial)
  return (
    <>
      <Label htmlFor="role">Role</Label>
      <Select
        id="role"
        value={v}
        placeholder="Choose…"
        options={ROLES}
        onValueChange={next => {
          setV(next)
          onChange(next)
        }}
      />
    </>
  )
}

describe('Select', () => {
  it('the label names the trigger', () => {
    render(<Field />)
    expect(screen.getByRole('combobox', {name: 'Role'})).toBeInTheDocument()
  })

  it('shows the placeholder when value is empty', () => {
    render(<Field />)
    expect(screen.getByRole('combobox', {name: 'Role'})).toHaveTextContent('Choose…')
  })

  it('opens on click and selects an option', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<Field onChange={onChange} />)
    await user.click(screen.getByRole('combobox', {name: 'Role'}))
    await user.click(await screen.findByRole('option', {name: 'SUPPORT'}))
    expect(onChange).toHaveBeenCalledWith('SUPPORT')
    expect(screen.getByRole('combobox', {name: 'Role'})).toHaveTextContent('SUPPORT')
  })

  it('keyboard: Enter opens, ArrowDown + Enter selects', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<Field onChange={onChange} initial="ADMIN" />)
    screen.getByRole('combobox', {name: 'Role'}).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('SUPPORT')
  })

  it('the highlight indicator follows ArrowDown', async () => {
    const user = userEvent.setup()
    render(<Field initial="ADMIN" />)
    screen.getByRole('combobox', {name: 'Role'}).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    const indicator = document.querySelector('[data-slot=select-indicator]')
    expect(screen.getByRole('option', {name: 'VIEWER'})).toContainElement(indicator as HTMLElement)
  })
})
