'use client'

import {DataTable} from '@/components/data-table'
import {SkeletonRows} from '@/components/skeleton'
import {ToneDot} from '@/components/status-dot'
import {useApiError} from '@/hooks/use-error-text'
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
  const apiError = useApiError()
  const admins = useGetApiAdminAdminsQuery()
  const roles = useGetApiAdminRolesQuery()
  const [remove] = useDeleteApiAdminAdminsByIdMutation()
  const [reset] = usePostApiAdminAdminsByIdReset2FaMutation()
  const [changeRole] = usePatchApiAdminAdminsByIdRoleMutation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (admins.isLoading) return <SkeletonRows rows={3} />
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
    if ('error' in result) setError(apiError(result.error))
    setPending(null)
  }

  const list = admins.data ?? []
  const target = list.find(a => a.id === pending?.adminId)
  const newRole = assignable.find(r => r.id === pending?.roleId)
  const open = (adminId: string, kind: Pending['kind']) => () => {
    setError(null)
    setPending({adminId, kind})
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {pending && target && (
        <div className="flex flex-col gap-3 rounded-card bg-card p-4">
          {pending.kind === 'role' && (
            <Select
              aria-label={`Role of ${target.email}`}
              className="max-w-xs"
              value={pending.roleId ?? target.role.id}
              options={[
                ...(assignable.some(r => r.id === target.role.id)
                  ? []
                  : [{value: target.role.id, label: target.role.name}]),
                ...assignable.map(r => ({value: r.id, label: r.name}))
              ]}
              onValueChange={v => {
                setPending({
                  adminId: target.id,
                  kind: 'role',
                  roleId: v === target.role.id ? undefined : v
                })
              }}
            />
          )}
          <p className="text-[13px]">
            {pending.kind === 'remove' &&
              `Remove ${target.email}? They lose access and are signed out everywhere.`}
            {pending.kind === 'reset' &&
              `Reset two-factor for ${target.email}? They are signed out everywhere and must set it up again.`}
            {pending.kind === 'role' &&
              (newRole
                ? `Change ${target.email} to ${newRole.name}? They are signed out everywhere and must sign in again.`
                : `Pick the new role for ${target.email}.`)}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={pending.kind === 'role' ? 'default' : 'danger'}
              disabled={pending.kind === 'role' && !newRole}
              onClick={() => void confirm(pending)}>
              {pending.kind === 'remove'
                ? 'Remove'
                : pending.kind === 'reset'
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
      )}
      <DataTable
        caption="Admins"
        rows={list}
        rowKey={a => a.id}
        rowLabel={a => a.email}
        columns={[
          {
            header: 'Admin',
            primary: true,
            cell: a => (
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{a.email}</span>
                <span className="truncate text-[12px] text-muted">{a.name}</span>
              </span>
            )
          },
          {header: 'Role', cell: a => a.role.name},
          {
            header: '2FA',
            cell: a => (
              <ToneDot
                tone={a.twoFactorEnabled ? 'ok' : 'warn'}
                label={a.twoFactorEnabled ? 'On' : 'Off'}
              />
            )
          },
          {
            header: 'Status',
            cell: a =>
              a.disabledAt === null ? (
                <ToneDot tone="ok" label="Active" />
              ) : (
                <ToneDot tone="idle" label="Removed" />
              )
          }
        ]}
        menu={a =>
          a.role.name === OWNER || a.disabledAt !== null
            ? []
            : [
                ...(canChangeRoles ? [{label: 'Change role', onSelect: open(a.id, 'role')}] : []),
                {label: 'Reset 2FA', onSelect: open(a.id, 'reset')},
                {label: 'Remove', tone: 'danger' as const, onSelect: open(a.id, 'remove')}
              ]
        }
      />
    </div>
  )
}
