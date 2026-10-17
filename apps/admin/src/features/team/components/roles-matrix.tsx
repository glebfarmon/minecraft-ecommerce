'use client'

import {RoleNameSchema} from '@/features/team/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  useDeleteApiAdminRolesByIdMutation,
  useGetApiAdminRolesQuery,
  usePatchApiAdminRolesByIdMutation,
  usePostApiAdminRolesMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {PERMISSIONS, type Permission} from '@shop/shared/access'
import {Button} from '@shop/ui/button'
import {Checkbox} from '@shop/ui/checkbox'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'

const sameSet = (a: readonly Permission[], b: readonly Permission[]) =>
  a.length === b.length && a.every(p => b.includes(p))

const toggle = (list: readonly Permission[], p: Permission, on: boolean): Permission[] =>
  on ? [...list.filter(x => x !== p), p] : list.filter(x => x !== p)

export function RolesMatrix({
  editable,
  held = PERMISSIONS
}: {
  editable: boolean
  /** Permissions the viewer holds; others are disabled (the API enforces it too). */
  held?: readonly Permission[]
}) {
  const roles = useGetApiAdminRolesQuery()
  const [createRole, {isLoading: creating}] = usePostApiAdminRolesMutation()
  const [updateRole] = usePatchApiAdminRolesByIdMutation()
  const [deleteRole] = useDeleteApiAdminRolesByIdMutation()
  const [drafts, setDrafts] = useState<Record<string, Permission[]>>({})
  const [newPermissions, setNewPermissions] = useState<Permission[]>([])
  const [confirming, setConfirming] = useState<{id: string; kind: 'save' | 'delete'} | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {register, handleSubmit, control, reset} = useForm({
    resolver: valibotResolver(RoleNameSchema),
    defaultValues: {name: ''}
  })
  const {errors} = useFormState({control})

  if (roles.isLoading) return <p>Loading roles…</p>
  if (roles.isError) return <p role="alert">Could not load roles. Refresh the page.</p>

  async function run(action: Promise<{error?: unknown}>) {
    setError(null)
    const result = await action
    if (result.error) setError(apiErrorMessage(result.error))
    return !result.error
  }

  const onCreate = handleSubmit(async ({name}) => {
    const ok = await run(createRole({body: {name, permissions: newPermissions}}))
    if (ok) {
      reset()
      setNewPermissions([])
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Changing a role signs out everyone who has it. You can only give out permissions you hold.
        System roles are read-only.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            {PERMISSIONS.map(p => (
              <TableHead key={p}>{p}</TableHead>
            ))}
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(roles.data ?? []).map(role => {
            const draft = drafts[role.id] ?? role.permissions
            const locked = role.isSystem || !editable
            const dirty = !sameSet(draft, role.permissions)
            return (
              <TableRow key={role.id}>
                <TableCell>
                  {role.name}
                  {role.isSystem && <span className="text-muted-foreground"> (system)</span>}
                </TableCell>
                {PERMISSIONS.map(p => (
                  <TableCell key={p}>
                    <Checkbox
                      aria-label={`${role.name} ${p}`}
                      checked={draft.includes(p)}
                      disabled={locked || !held.includes(p)}
                      onCheckedChange={on => {
                        setDrafts(d => ({...d, [role.id]: toggle(draft, p, on === true)}))
                      }}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  {!locked &&
                    (confirming?.id === role.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm">
                          {confirming.kind === 'save'
                            ? `Save ${role.name}? Everyone with this role is signed out.`
                            : `Delete ${role.name}? Fails while the role is in use.`}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => {
                              setConfirming(null)
                              if (confirming.kind === 'delete') {
                                void run(deleteRole({id: role.id}))
                                return
                              }
                              void run(
                                updateRole({
                                  id: role.id,
                                  body: {name: role.name, permissions: draft}
                                })
                              ).then(ok => {
                                if (ok)
                                  setDrafts(d =>
                                    Object.fromEntries(
                                      Object.entries(d).filter(([id]) => id !== role.id)
                                    )
                                  )
                              })
                            }}>
                            {confirming.kind === 'save' ? 'Save role' : 'Delete role'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setConfirming(null)
                            }}>
                            Back
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          aria-label={`Save ${role.name}`}
                          disabled={!dirty}
                          onClick={() => {
                            setConfirming({id: role.id, kind: 'save'})
                          }}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={`Delete ${role.name}`}
                          onClick={() => {
                            setConfirming({id: role.id, kind: 'delete'})
                          }}>
                          Delete
                        </Button>
                      </div>
                    ))}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {editable && (
        <form
          onSubmit={e => void onCreate(e)}
          className="flex flex-col items-start gap-3"
          noValidate
          aria-label="New role">
          <div className="flex flex-col gap-1">
            <Label htmlFor="role-name">New role name</Label>
            <Input
              id="role-name"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'role-name-error' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="role-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            {PERMISSIONS.map(p => (
              <div key={p} className="flex items-center gap-2">
                <Checkbox
                  id={`new-${p}`}
                  checked={newPermissions.includes(p)}
                  disabled={!held.includes(p)}
                  onCheckedChange={on => {
                    setNewPermissions(l => toggle(l, p, on === true))
                  }}
                />
                <Label htmlFor={`new-${p}`}>{p}</Label>
              </div>
            ))}
          </div>
          <Button type="submit" disabled={creating}>
            Create role
          </Button>
        </form>
      )}
    </div>
  )
}
