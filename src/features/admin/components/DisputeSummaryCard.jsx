import { Avatar } from '../../../components/ui/avatar'
import { PresenceDot } from '../../../common/layout/components/navShared'
import { formatRelativeDate } from '../../../common/utils/date'

export default function DisputeSummaryCard({ dispute }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-3">
        <span className="relative inline-block shrink-0">
          <Avatar initial={dispute.member.avatarInitial} color={dispute.member.avatarColor} size="sm" />
          <PresenceDot status={dispute.member.presenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{dispute.member.name}</p>
          <p className="text-xs text-ink-4">對「{dispute.planName}」（團主：{dispute.host.name}）提出申訴 · {formatRelativeDate(dispute.raisedAt)}</p>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">
        {dispute.reason}
      </p>
      {dispute.hostDisputed && (
        <div className="mt-2 rounded-lg border border-danger/40 bg-danger-subtle px-3 py-2">
          <p className="mb-1 text-xs font-semibold text-danger-text">團主標記為回報不實</p>
          <p className="whitespace-pre-wrap break-words text-xs text-danger-text">{dispute.hostResponseNote}</p>
        </div>
      )}
    </div>
  )
}
