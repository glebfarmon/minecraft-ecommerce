'use client'

import {InviteFormSchema} from '@/features/team/schemas'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  useDeleteApiAdminInvitesByIdMutation,
  useGetApiAdminInvitesQuery,
  useGetApiAdminRolesQuery,
  usePostApiAdminInvitesByIdResendMutation,
  usePostApiAdminInvitesMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {PERMISSIONS, type Permission} from '@shop/shared/access'
import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'

type InviteRow = {acceptedAt: string | null; revokedAt: string | null; expiresAt: string}

function statusOf(invite: InviteRow): 'Accepted' | 'Revoked' | 'Expired' | 'Open' {
  if (invite.acceptedAt) return 'Accepted'
  if (invite.revokedAt) return 'Revoked'
  if (new Date(invite.expiresAt).getTime() < Date.now()) return 'Expired'
  return 'Open'
}

export function InvitesPanel({held = PERMISSIONS}: {held?: readonly Permission[]}) {
  const invites = useGetApiAdminInvitesQuery()
  const roles = useGetApiAdminRolesQuery()
  const [create, {isLoading: creating}] = usePostApiAdminInvitesMutation()
  const [resend] = usePostApiAdminInvitesByIdResendMutation()
  const [cancel] = useDeleteApiAdminInvitesByIdMutation()
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const {register, handleSubmit, control, reset} = useForm({
    resolver: valibotResolver(InviteFormSchema),
    defaultValues: {email: ''}
  })
  const {errors} = useFormState({control})

  const assignable = (roles.data ?? []).filter(
    r => r.name !== 'OWNER' && r.permissions.every(p => held.includes(p))
  )
  const chosenRole = roleId || assignable[0]?.id || ''

  async function run(action: Promise<{error?: unknown}>, done?: string) {
    setError(null)
    setNotice(null)
    const result = await action
    if (result.error) setError(apiErrorMessage(result.error))
    else if (done) setNotice(done)
    return !result.error
  }

  const onSubmit = handleSubmit(async ({email}) => {
    const ok = await run(create({body: {email, roleId: chosenRole}}), `Invite sent to ${email}.`)
    if (ok) reset()
  })

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={e => void onSubmit(e)}
        className="flex flex-wrap items-start gap-3"
        noValidate>
        <div className="flex flex-col gap-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'invite-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="invite-email-error" role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            id="invite-role"
            value={chosenRole}
            onChange={e => {
              setRoleId(e.target.value)
            }}>
            {assignable.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" className="mt-6" disabled={creating || !chosenRole}>
          Send invite
        </Button>
      </form>
      {notice && <p className="text-sm">{notice}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {invites.isLoading && <p>Loading invites…</p>}
      {invites.isError && <p role="alert">Could not load invites. Refresh the page.</p>}
      {invites.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.data.map(invite => {
              const status = statusOf(invite)
              const closed = status === 'Accepted' || status === 'Revoked'
              return (
                <TableRow key={invite.id}>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>{invite.role.name}</TableCell>
                  <TableCell>{status}</TableCell>
                  <TableCell>{new Date(invite.expiresAt).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell>
                    {!closed &&
                      (confirming === invite.id ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-sm">
                            Revoke the invite for {invite.email}? The link stops working.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                setConfirming(null)
                                void run(cancel({id: invite.id}))
                              }}>
                              Revoke invite
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setConfirming(null)
                              }}>
                              Keep invite
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            aria-label={`Resend ${invite.email}`}
                            onClick={() =>
                              void run(
                                resend({id: invite.id}),
                                `Invite re-sent to ${invite.email}.`
                              )
                            }>
                            Resend
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            aria-label={`Cancel ${invite.email}`}
                            onClick={() => {
                              setConfirming(invite.id)
                            }}>
                            Cancel
                          </Button>
                        </div>
                      ))}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
