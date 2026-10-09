import {renderWithCatalog} from '@/features/catalog/test-catalog'
import {screen} from '@testing-library/react'

import {useCatalog} from './catalog-provider'

function Probe() {
  const {available, servers, findServer, findProduct, categoryName} = useCatalog()
  return (
    <p>
      {[
        String(available),
        String(servers.length),
        findServer('anarchy')?.name,
        findProduct('survival', 'vip')?.name,
        String(findProduct('anarchy', 'vip')?.slug),
        categoryName('cosmetics'),
        categoryName('unknown')
      ].join('|')}
    </p>
  )
}

describe('CatalogProvider', () => {
  it('looks up servers, products (per server) and category names', () => {
    renderWithCatalog(<Probe />)
    expect(screen.getByText('true|3|Anarchy|VIP|undefined|Cosmetics|unknown')).toBeInTheDocument()
  })

  it('is empty and unavailable without a catalog', () => {
    renderWithCatalog(<Probe />, null)
    expect(screen.getByText('false|0|||undefined|cosmetics|unknown')).toBeInTheDocument()
  })
})
