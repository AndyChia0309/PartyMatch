import { useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquareText } from 'lucide-react'
import { AvatarWithPresence } from '../../../../components/ui/avatar'
import { Button } from '../../../../components/ui/button'
import CreditScoreBadge from '../../../../components/ui/CreditScoreBadge'
import { formatDateTime, formatRelativeDate } from '../../../../common/utils/date'

const APP_STATUS_BADGE = {
  approved: { cls: 'bg-success-subtle text-success-text', label: '已接受' },
  rejected: { cls: 'bg-danger-subtle text-danger-text',   label: '已拒絕' },
  left:     { cls: 'bg-raised text-ink-3',                label: '已退出' },
  removed:  { cls: 'bg-danger-subtle text-danger-text',   label: '已移除' },
}

export default function ApplicationCard({ app, groupFull, error, submitting, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false)
  const name    = app.applicantName ?? app.userName ?? '申請者'
  const initial = app.applicantAvatarInitial ?? app.userAvatarInitial ?? name[0]
  const color   = app.applicantAvatarColor ?? app.userAvatarColor ?? '#64718A'
  const presenceStatus = app.applicantPresenceStatus ?? app.userPresenceStatus ?? 'offline'
  const isPending = app.status === 'pending'
  const badge = APP_STATUS_BADGE[app.status]

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <AvatarWithPresence initial={initial} color={color} size="md" presenceStatus={presenceStatus} dotClassName="h-3 w-3" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">{name}</p>
            <CreditScoreBadge score={app.applicantCreditScore ?? 80} />
          </div>
          <p className="mt-0.5 text-2xs text-ink-4">
            {isPending ? formatRelativeDate(app.createdAt) : formatDateTime(app.updatedAt)}
          </p>
        </div>
        {!isPending && badge && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {isPending && app.message && (
          <Button
            variant={expanded ? 'secondary' : 'ghost'}
            onClick={() => setExpanded(v => !v)}
            aria-label="申請留言"
            className="h-11 w-11 shrink-0 rounded-xl border border-line p-0"
          >
            <MessageSquareText size={16} strokeWidth={1.5} />
          </Button>
        )}
      </div>
      {app.message && (
        <div className="mt-2">
          {!isPending && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-ink"
            >
              申請留言 {expanded ? <ChevronUp size={11} strokeWidth={1.5} /> : <ChevronDown size={11} strokeWidth={1.5} />}
            </button>
          )}
          {expanded && (
            <p className="my-3 text-xs leading-relaxed text-ink-2"><span className="font-semibold text-ink-3">申請留言：</span>{app.message}</p>
          )}
        </div>
      )}
      {error && <p className="ml-[52px] mt-1.5 text-xs text-danger">{error}</p>}
      {isPending && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="default"
            onClick={() => onApprove(app.id)}
            disabled={groupFull || submitting}
            loading={submitting}
            className="h-auto flex-1 rounded-lg py-2.5 text-sm"
          >
            {groupFull ? '已額滿' : '接受'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onReject(app.id)}
            disabled={submitting}
            loading={submitting}
            className="h-auto flex-1 rounded-lg py-2.5 text-sm"
          >
            拒絕
          </Button>
        </div>
      )}
    </div>
  )
}
