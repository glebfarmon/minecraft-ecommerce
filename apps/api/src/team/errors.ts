import {BadRequestException, ConflictException, NotFoundException} from '@nestjs/common'

/** The OWNER user and the system roles cannot be changed, and nobody is granted OWNER (spec §7.4). */
export const ownerProtected = () =>
  new BadRequestException({statusCode: 400, message: 'owner_protected'})

export const notFound = () => new NotFoundException({statusCode: 404, message: 'not_found'})

export const unknownRole = () => new BadRequestException({statusCode: 400, message: 'unknown_role'})

export const conflict = (message: string) => new ConflictException({statusCode: 409, message})

export const isOwnerRole = (role: {name: string; isSystem: boolean} | null | undefined): boolean =>
  role?.name === 'OWNER' && role.isSystem
