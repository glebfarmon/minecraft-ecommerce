import type {IncomingMessage} from 'node:http'

import type {Permission} from '@shop/shared/access'

export type AdminContext = {
  userId: string
  sessionId: string
  email: string
  name: string
  role: {id: string; name: string; isSystem: boolean}
  permissions: Permission[]
}

/** The Node request under Nest's Express adapter; the guard sets `admin`. */
export type AdminRequest = IncomingMessage & {admin?: AdminContext}

export function adminOf(req: AdminRequest): AdminContext {
  if (!req.admin) throw new Error('adminOf() outside AdminSessionGuard')
  return req.admin
}
