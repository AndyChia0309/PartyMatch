import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Avatar } from '../../../../components/ui/avatar'
import { PresenceDot } from '../../../../common/layout/components/navShared'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../../../components/ui/collapsible'
import CountdownText from '../../../../components/ui/primitives/CountdownText'
import EvidenceLink from '../../../../components/ui/EvidenceLink'
import { formatDisputeReason, DISPUTE_ESCALATED_BANNER_TEXT } from '../../../../common/utils/memberGroupDisplay'

export default function MemberAccountStatusRow({ member, isSharedCredentials }) {
  const [expanded, setExpanded] = useState(false)
  const hasIssue = !!member.hasServiceInfoIssue
  const isServiceIssueOnly = hasIssue && !member.disputeDeadline
  const canShowIssueDetail = member.isSelf && hasIssue && !!member.issueNote
  const evidenceUrl = member.disputeEvidenceUrl ?? member.serviceInfoIssueEvidenceUrl
  const { types: issueTypes, detail: issueDetail } = formatDisputeReason(member.issueNote)
  const statusClass = hasIssue
    ? 'text-danger-text'
    : member.hasServiceInfo
      ? (member.confirmDeadline && !member.confirmedAt ? 'text-info-text' : 'text-success-text')
      : isSharedCredentials && member.extractionStartedAt
        ? 'text-info-text'
        : 'text-ink-4'

  function renderStatus() {
    if (hasIssue) {
      if (isServiceIssueOnly) {
        return (
          <>
            回報問題處理中
            {member.serviceInfoIssueDeadline && (
              <>，剩餘 <CountdownText deadline={member.serviceInfoIssueDeadline} /></>
            )}
          </>
        )
      }

      return (
        <>
          {member.disputeEscalatedAt ? DISPUTE_ESCALATED_BANNER_TEXT : '回報問題待處理'}
          {member.disputeDeadline && (
            <>，剩餘 <CountdownText deadline={member.disputeDeadline} /></>
          )}
        </>
      )
    }

    if (member.hasServiceInfo) {
      if (member.confirmedAt) return '已確認服務'
      if (member.confirmDeadline) return '尚未確認服務'
      return isSharedCredentials ? '已成功提取帳號' : '已填寫帳號資訊'
    }

    if (isSharedCredentials && member.extractionStartedAt) return '已查看帳號資訊'
    return isSharedCredentials ? '尚未提取帳號' : '尚未填寫帳號資訊'
  }

  const header = (
    <div className="flex w-full items-center gap-3 text-left">
      <span className="relative inline-block shrink-0">
        <Avatar initial={member.userAvatarInitial} color={member.userAvatarColor} size="sm" />
        <PresenceDot status={member.userPresenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{member.userName}{member.isSelf ? '（你）' : ''}</p>
        <p className={`text-xs ${statusClass}`}>{renderStatus()}</p>
      </div>
      {canShowIssueDetail && !isServiceIssueOnly && (
        <ChevronDown size={16} strokeWidth={1.5} className={`shrink-0 text-ink-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      )}
    </div>
  )

  const profileDetail = member.profileName ? (
    <dl className="mt-2 rounded-lg border border-line px-3 py-2">
      <div className="flex items-baseline gap-2 text-xs">
        <dt className="shrink-0 text-ink-4">Profile 名稱：</dt>
        <dd className="min-w-0 truncate text-ink-2">{member.profileName}</dd>
      </div>
    </dl>
  ) : null

  const issueDetailBlock = canShowIssueDetail ? (
    <div className="mt-2 w-full space-y-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">
      {isServiceIssueOnly ? (
        <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題說明：</span>{member.issueNote}</p>
      ) : (
        <>
          <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題類型：</span>{issueTypes}</p>
          {issueDetail && (
            <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題說明：</span>{issueDetail}</p>
          )}
        </>
      )}
      <EvidenceLink
        url={evidenceUrl}
        className="flex w-fit items-center gap-1 text-xs font-medium text-brand underline hover:text-brand/80"
      />
    </div>
  ) : null

  if (canShowIssueDetail && !isServiceIssueOnly) {
    return (
      <div className="rounded-lg border border-line p-3">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full">
              {header}
            </button>
          </CollapsibleTrigger>
          {profileDetail}
          <CollapsibleContent>{issueDetailBlock}</CollapsibleContent>
        </Collapsible>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line p-3">
      {header}
      {profileDetail}
      {issueDetailBlock}
    </div>
  )
}
