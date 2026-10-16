/** @jest-environment node */
const load = async (value: string | undefined): Promise<number> => {
  const before = process.env.CONTENT_REVALIDATE_SECONDS
  if (value === undefined) delete process.env.CONTENT_REVALIDATE_SECONDS
  else process.env.CONTENT_REVALIDATE_SECONDS = value
  jest.resetModules()
  const {CONTENT_REVALIDATE_SECONDS: out} = await import('./content')
  if (before === undefined) delete process.env.CONTENT_REVALIDATE_SECONDS
  else process.env.CONTENT_REVALIDATE_SECONDS = before
  return out
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('CONTENT_REVALIDATE_SECONDS', () => {
  it('reads the env', async () => {
    await expect(load('1')).resolves.toBe(1)
  })

  it('defaults to 60', async () => {
    await expect(load(undefined)).resolves.toBe(60)
  })

  it.each(['0', 'abc', '-5', '1.5'])(
    'refuses %s with a warning and falls back to 60',
    async raw => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      await expect(load(raw)).resolves.toBe(60)
      expect(warn).toHaveBeenCalled()
    }
  )
})
