import {BadRequestException} from '@nestjs/common'

export {conflict, notFound} from '../common/http-errors'

/** The OWNER user and the system roles cannot be changed, and nobody is granted OWNER (spec §7.4). */
export const ownerProtected = () =>
  new BadRequestException({statusCode: 400, message: 'owner_protected'})

export const unknownRole = () => new BadRequestException({statusCode: 400, message: 'unknown_role'})

export const isOwnerRole = (role: {name: string; isSystem: boolean} | null | undefined): boolean =>
  role?.name === 'OWNER' && role.isSystem
