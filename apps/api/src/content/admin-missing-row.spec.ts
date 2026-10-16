import {RulesAdminService} from './rules-admin.service'
import {SettingsAdminService} from './settings-admin.service'

/** A database without the content rows (seed not run yet): every model is empty. */
function emptyDb() {
  const empty = {
    findUnique: jest.fn(() => Promise.resolve(null)),
    findUniqueOrThrow: jest.fn(() => Promise.reject(new Error('No record found'))),
    updateMany: jest.fn(() => Promise.resolve({count: 0})),
    count: jest.fn(() => Promise.resolve(0))
  }
  const tx = {
    rulesDraft: empty,
    rulesVersion: {...empty, findUnique: jest.fn(() => Promise.resolve({id: 1, content: {}}))},
    siteSettings: empty,
    $queryRaw: jest.fn(() => Promise.resolve([]))
  }
  return {...tx, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)} as never
}

const notFound = expect.objectContaining({
  status: 404,
  response: expect.objectContaining({message: 'not_found'}) as unknown
}) as Error

describe('content admin without seeded rows', () => {
  const rules = () => new RulesAdminService(emptyDb())
  const settings = () => new SettingsAdminService(emptyDb())
  const noop = () => undefined

  it('reading the draft answers 404 not_found', async () => {
    await expect(rules().draft()).rejects.toEqual(notFound)
  })
  it('saving the draft answers 404 not_found, not 409 stale', async () => {
    await expect(
      rules().save({content: {sections: []}, revision: 0}, 'a@b.co', noop)
    ).rejects.toEqual(notFound)
  })
  it('publishing answers 404 not_found', async () => {
    await expect(rules().publish(0, 'a@b.co')).rejects.toEqual(notFound)
  })
  it('restoring answers 404 not_found', async () => {
    await expect(rules().restore(1, 'a@b.co', noop)).rejects.toEqual(notFound)
  })
  it('reading the settings answers 404 not_found', async () => {
    await expect(settings().get()).rejects.toEqual(notFound)
  })
})
