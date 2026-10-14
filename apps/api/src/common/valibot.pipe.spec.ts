import {BadRequestException} from '@nestjs/common'

import {CatalogQuerySchema} from '@shop/shared/catalog'

import {ValibotPipe} from './valibot.pipe'

describe('ValibotPipe', () => {
  const pipe = new ValibotPipe(CatalogQuerySchema)

  it('returns the parsed value', () => {
    expect(pipe.transform({locale: 'pl', extra: 'x'})).toEqual({locale: 'pl'})
  })

  it.each([{}, {locale: 'PL'}, {locale: ['en', 'pl']}])('throws 400 for %p', query => {
    expect(() => pipe.transform(query)).toThrow(BadRequestException)
  })

  it('reports which field failed', () => {
    try {
      pipe.transform({locale: 'de'})
      throw new Error('expected a BadRequestException')
    } catch (error) {
      const body = (error as BadRequestException).getResponse() as {
        message: string
        issues: {nested?: Record<string, string[]>}
      }
      expect(body.message).toBe('Validation failed')
      expect(body.issues.nested?.locale).toHaveLength(1)
    }
  })
})
