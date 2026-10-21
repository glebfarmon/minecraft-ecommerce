'use client'

import {DataTable} from '@/components/data-table'
import {EmptyState} from '@/components/empty-state'
import {FormSection} from '@/components/form-section'
import {SkeletonRows} from '@/components/skeleton'
import {type Tone, ToneDot} from '@/components/status-dot'
import {notify} from '@/components/toaster'
import {InviteFormSchema} from '@/features/team/schemas'
import {useErrorText} from '@/hooks/use-error-text'
import {useMessage} from '@/hooks/use-message'
import {useReportError} from '@/hooks/use-report-error'
import {
  useDeleteApiAdminInvitesByIdMutation,
  useGetApiAdminInvitesQuery,
  useGetApiAdminRolesQuery,
  usePostApiAdminInvitesByIdResendMutation,
  usePostApiAdminInvitesMutation
} from '@/lib/api/generated'
import {valibotResolver} from '@hookform/resolvers/valibot'
import {MailPlus} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm, useFormState} from 'react-hook-form'

import {PERMISSIONS, type Permission} from '@shop/shared/access'
import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Select} from '@shop/ui/select'

type InviteRow = {acceptedAt: string | null; revokedAt: string | null; expiresAt: string}

type Status = ReturnType<typeof statusOf>
const STATUS_TONE: Record<Status, Tone> = {
  Open: 'warn',
  Accepted: 'ok',
  Expired: 'idle',
  Revoked: 'idle'
}

function statusOf(invite: InviteRow): 'Accepted' | 'Revoked' | 'Expired' | 'Open' {
  if (invite.acceptedAt) return 'Accepted'
  if (invite.revokedAt) return 'Revoked'
  if (new Date(invite.expiresAt).getTime() < Date.now()) return 'Expired'
  return 'Open'
}

export function InvitesPanel({held = PERMISSIONS}: {held?: readonly Permission[]}) {
  const t = useTranslations('team')
  const uiLocale = useLocale()
  const errorText = useErrorText()
  const invites = useGetApiAdminInvitesQuery()
  const roles = useGetApiAdminRolesQuery()
  const [create, {isLoading: creating}] = usePostApiAdminInvitesMutation()
  const [resend] = usePostApiAdminInvitesByIdResendMutation()
  const [cancel] = useDeleteApiAdminInvitesByIdMutation()
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useMessage()
  const report = useReportError(setError)
  const [confirming, setConfirming] = useState<string | null>(null)

  const {register, handleSubmit, control, reset} = useForm({
    resolver: valibotResolver(InviteFormSchema),
    defaultValues: {email: ''}
  })
  const {errors} = useFormState({control})

  const assignable = (roles.data ?? []).filter(
    r => r.name !== 'OWNER' && r.permissions.every(p => held.includes(p))
  )
  const chosenRole = roleId || assignable[0]?.id || ''

  async function run(action: Promise<{error?: unknown}>, done: string) {
    setError(null)
    const result = await action
    if (result.error) report(result.error)
    else notify.ok(done)
    return !result.error
  }

  const onSubmit = handleSubmit(async ({email}) => {
    const ok = await run(create({body: {email, roleId: chosenRole}}), t('inviteSent', {email}))
    if (ok) reset()
  })

  const target = invites.data?.find(i => i.id === confirming)

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={e => void onSubmit(e)} noValidate>
        <FormSection title={t('inviteAnAdmin')} description={t('theyGetAnEmailWithA')}>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="invite-email">{t('email')}</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'invite-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="invite-email-error" role="alert" className="text-xs text-destructive">
                {errorText(errors.email.message)}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="invite-role">{t('role')}</Label>
            <Select
              id="invite-role"
              value={chosenRole}
              options={assignable.map(r => ({value: r.id, label: r.name}))}
              onValueChange={setRoleId}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={creating || !chosenRole}>
              {t('sendInvite')}
            </Button>
          </div>
        </FormSection>
      </form>
      {error && (
        <p role="alert" className="rounded-plate bg-bad-soft px-4 py-3 text-bad">
          {error}
        </p>
      )}
      {target && (
        <div className="flex flex-col gap-3 rounded-card bg-card p-4">
          <p className="text-[13px]">{t('confirmRevoke', {email: target.email})}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setConfirming(null)
                void run(cancel({id: target.id}), t('inviteRevoked'))
              }}>
              {t('revokeInvite')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirming(null)
              }}>
              {t('keepInvite')}
            </Button>
          </div>
        </div>
      )}
      {invites.isLoading && <SkeletonRows rows={3} />}
      {invites.isError && (
        <p role="alert" className="rounded-card bg-card p-5">
          {t('couldNotLoadInvitesRefreshThe')}
        </p>
      )}
      {invites.data && (
        <DataTable
          caption={t('invites')}
          rows={invites.data}
          rowKey={i => i.id}
          rowLabel={i => i.email}
          columns={[
            {header: t('email'), primary: true, cell: i => i.email},
            {header: t('role'), cell: i => i.role.name},
            {
              header: t('status'),
              cell: i => {
                const status = statusOf(i)
                return <ToneDot tone={STATUS_TONE[status]} label={t(`inviteStatus${status}`)} />
              }
            },
            {
              header: t('expires'),
              cell: i =>
                new Date(i.expiresAt).toLocaleDateString(uiLocale === 'pl' ? 'pl-PL' : 'en-GB'),
              className: 'tabular text-muted'
            }
          ]}
          menu={i => {
            const status = statusOf(i)
            if (status === 'Accepted' || status === 'Revoked') return []
            return [
              {
                label: t('resend'),
                onSelect: () => void run(resend({id: i.id}), t('inviteResent', {email: i.email}))
              },
              {
                label: t('revoke'),
                tone: 'danger',
                onSelect: () => {
                  setConfirming(i.id)
                }
              }
            ]
          }}
          empty={<EmptyState icon={MailPlus} title={t('noPendingInvites')} />}
        />
      )}
    </div>
  )
}
