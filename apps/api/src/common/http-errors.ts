import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common'

/** The API's error bodies: `{statusCode, message, issues?}`; `message` is a stable code. */
export const notFound = () => new NotFoundException({statusCode: 404, message: 'not_found'})

export const conflict = (message: string, issues?: Record<string, unknown>) =>
  new ConflictException({statusCode: 409, message, ...(issues && {issues})})

export const badRequest = (message: string, issues?: Record<string, unknown>) =>
  new BadRequestException({statusCode: 400, message, ...(issues && {issues})})

export const serviceUnavailable = (message: string) =>
  new ServiceUnavailableException({statusCode: 503, message})

/** Someone saved first: the client's version or id list is out of date. */
export const stale = () => conflict('stale')

/** Delete or detach blocked by rows that still reference the record. */
export const inUse = (counts: Record<string, number>) => conflict('in_use', counts)
