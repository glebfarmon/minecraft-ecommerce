import {renderWithCatalog} from '@/features/catalog/test-catalog'
import {screen} from '@testing-library/react'

import {useCatalog} from './catalog-provider'

function Probe() {
  const catalog = useCatalog()
  return (
    <p>
      {[
        String(catalog.available),
        String(catalog.servers.length),
        catalog.findServer('anarchy')?.name,
        catalog.categoryName('cosmetics'),
        catalog.categoryName('unknown'),
        String('products' in catalog)
      ].join('|')}
    </p>
  )
}

describe('CatalogProvider', () => {
  it('looks up servers and category names, and carries no products', () => {
    renderWithCatalog(<Probe />)
    expect(screen.getByText('true|3|Anarchy|Cosmetics|unknown|false')).toBeInTheDocument()
  })

  it('is empty and unavailable without a catalog', () => {
    renderWithCatalog(<Probe />, null)
    expect(screen.getByText('false|0||cosmetics|unknown|false')).toBeInTheDocument()
  })
})
