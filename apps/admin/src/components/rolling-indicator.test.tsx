import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {useState} from 'react'

import {Tabs, TabsList, TabsTrigger} from '@shop/ui/tabs'

function indicators(container: HTMLElement) {
  return container.querySelectorAll('[data-slot=tabs-indicator]')
}

function Controlled() {
  const [v, setV] = useState('a')
  return (
    <Tabs value={v} onValueChange={setV}>
      <TabsList aria-label="T">
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

describe('Tabs indicator', () => {
  it('renders one indicator, inside the active trigger, and moves it (controlled)', async () => {
    const user = userEvent.setup()
    const {container} = render(<Controlled />)
    expect(indicators(container)).toHaveLength(1)
    expect(screen.getByRole('tab', {name: 'A'})).toContainElement(
      indicators(container)[0] as HTMLElement
    )
    await user.click(screen.getByRole('tab', {name: 'B'}))
    expect(indicators(container)).toHaveLength(1)
    expect(screen.getByRole('tab', {name: 'B'})).toContainElement(
      indicators(container)[0] as HTMLElement
    )
  })

  it('moves the indicator with defaultValue (uncontrolled)', async () => {
    const user = userEvent.setup()
    const {container} = render(
      <Tabs defaultValue="b">
        <TabsList aria-label="T">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    expect(screen.getByRole('tab', {name: 'B'})).toContainElement(
      indicators(container)[0] as HTMLElement
    )
    await user.click(screen.getByRole('tab', {name: 'A'}))
    expect(indicators(container)).toHaveLength(1)
    expect(screen.getByRole('tab', {name: 'A'})).toContainElement(
      indicators(container)[0] as HTMLElement
    )
  })

  it('tab triggers show keyboard focus without the accent ring', () => {
    render(<Controlled />)
    const cls = screen.getByRole('tab', {name: 'A'}).className
    expect(cls).not.toContain('ring-accent')
    expect(cls).toContain('focus-visible:after:z-10')
    expect(cls).toContain('focus-visible:after:ring-fg/40')
  })
})
