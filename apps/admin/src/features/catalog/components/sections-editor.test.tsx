import {emptyProductForm} from '@/features/catalog/lib/product-form'
import type {ProductForm} from '@/features/catalog/schemas'
import {renderWithIntl as render} from '@/test/render-with-providers'
import {fireEvent, screen} from '@testing-library/react'
import {useEffect} from 'react'
import {useForm, useWatch} from 'react-hook-form'

import {SectionsEditor} from './sections-editor'

let latest: ProductForm | undefined
const remember = (values: ProductForm) => {
  latest = values
}

function Harness({disabled = false}: {disabled?: boolean}) {
  const {control, register} = useForm<ProductForm>({defaultValues: emptyProductForm()})
  const values = useWatch({control}) as ProductForm
  useEffect(() => {
    remember(values)
  }, [values])
  return <SectionsEditor locale="en" control={control} register={register} disabled={disabled} />
}

describe('SectionsEditor', () => {
  it('adds, fills and removes sections and lines', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', {name: '+ Section'}))
    fireEvent.change(screen.getByLabelText('Section title'), {target: {value: 'Perks'}})
    fireEvent.click(screen.getByRole('button', {name: '+ Line'}))
    fireEvent.change(screen.getByLabelText('Command'), {target: {value: '/fly'}})
    expect(screen.getByRole('list', {name: 'Lines of Perks'})).toBeInTheDocument()
    expect(latest?.translations.en.sections).toEqual([
      {title: 'Perks', entries: [{cmd: '/fly', text: '', cooldown: ''}]}
    ])
    const [removeSection] = screen.getAllByRole('button', {name: 'Remove'})
    fireEvent.click(removeSection as HTMLElement)
    expect(latest?.translations.en.sections).toEqual([])
  })

  it('hides the editing buttons when disabled', () => {
    render(<Harness disabled />)
    expect(screen.queryByRole('button', {name: '+ Section'})).not.toBeInTheDocument()
  })
})
