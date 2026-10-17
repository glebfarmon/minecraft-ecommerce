'use client'

import {apiErrorMessage} from '@/lib/api/error-message'
import {
  useDeleteApiAdminAdminsByIdMutation,
  useGetApiAdminAdminsQuery,
  useGetApiAdminRolesQuery,
  usePatchApiAdminAdminsByIdRoleMutation,
  usePostApiAdminAdminsByIdReset2FaMutation
} from '@/lib/api/generated'
import {useState} from 'react'

import {PERMISSIONS, type Permission} from '@shop/shared/access'
import {Button} from '@shop/ui/button'
import {Select} from '@shop/ui/select'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'

type Pending = {adminId: string; kind: 'remove' | 'reset' | 'role'; roleId?: string}

const OWNER = 'OWNER'

export function AdminsTable({
  canChangeRoles,
  held = PERMISSIONS
}: {
  canChangeRoles: boolean
  /** Permissions the viewer holds; roles needing more cannot be handed out (the API enforces it). */
  held?: readonly Permission[]
}) {
  const admins = useGetApiAdminAdminsQuery()
  const roles = useGetApiAdminRolesQuery()
  const [remove] = useDeleteApiAdminAdminsByIdMutation()
  const [reset] = usePostApiAdminAdminsByIdReset2FaMutation()
  const [changeRole] = usePatchApiAdminAdminsByIdRoleMutation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (admins.isLoading) return <p>Loading admins…</p>
  if (admins.isError) return <p role="alert">Could not load admins. Refresh the page.</p>

  const assignable = (roles.data ?? []).filter(
    r => r.name !== OWNER && r.permissions.every(p => held.includes(p))
  )

  async function confirm(p: Pending) {
    setError(null)
    const result =
      p.kind === 'remove'
        ? await remove({id: p.adminId})
        : p.kind === 'reset'
          ? await reset({id: p.adminId})
          : await changeRole({id: p.adminId, body: {roleId: p.roleId ?? ''}})
    if ('error' in result) setError(apiErrorMessage(result.error))
    setPending(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>2FA</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(admins.data ?? []).map(admin => {
            const isOwner = admin.role.name === OWNER
            const disabled = admin.disabledAt !== null
            const mine = pending?.adminId === admin.id ? pending : null
            const newRole = assignable.find(r => r.id === mine?.roleId)
            return (
              <TableRow key={admin.id}>
                <TableCell>
                  <div>{admin.email}</div>
                  <div className="text-xs text-muted-foreground">{admin.name}</div>
                </TableCell>
                <TableCell>
                  {canChangeRoles && !isOwner && !disabled ? (
                    <Select
                      aria-label={`Role of ${admin.email}`}
                      value={mine?.kind === 'role' ? mine.roleId : admin.role.id}
                      onChange={e => {
                        setError(null)
                        setPending(
                          e.target.value === admin.role.id
                            ? null
                            : {adminId: admin.id, kind: 'role', roleId: e.target.value}
                        )
                      }}>
                      {admin.role.id && !assignable.some(r => r.id === admin.role.id) && (
                        <option value={admin.role.id}>{admin.role.name}</option>
                      )}
                      {assignable.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    admin.role.name
                  )}
                </TableCell>
                <TableCell>{admin.twoFactorEnabled ? 'On' : 'Off'}</TableCell>
                <TableCell>
                  {disabled ? (
                    <span className="text-muted-foreground">Removed</span>
                  ) : isOwner ? null : mine ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm">
                        {mine.kind === 'remove' &&
                          `Remove ${admin.email}? They lose access and are signed out everywhere.`}
                        {mine.kind === 'reset' &&
                          `Reset two-factor for ${admin.email}? They are signed out everywhere and must set it up again.`}
                        {mine.kind === 'role' &&
                          `Change ${admin.email} to ${newRole?.name ?? 'this role'}? They are signed out everywhere and must sign in again.`}
                      </p>
                      <div className="flex gap-2">
                        <Button type="button" size="default" onClick={() => void confirm(mine)}>
                          {mine.kind === 'remove'
                            ? 'Remove'
                            : mine.kind === 'reset'
                              ? 'Reset'
                              : 'Change role'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setPending(null)
                          }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Reset 2FA ${admin.email}`}
                        onClick={() => {
                          setError(null)
                          setPending({adminId: admin.id, kind: 'reset'})
                        }}>
                        Reset 2FA
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Remove ${admin.email}`}
                        onClick={() => {
                          setError(null)
                          setPending({adminId: admin.id, kind: 'remove'})
                        }}>
                        Remove
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
