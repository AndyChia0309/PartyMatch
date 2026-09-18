import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Avatar } from '../../../../components/ui/avatar'
import { PresenceDot } from '../../../../common/layout/components/navShared'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../../../components/ui/collapsible'
import CountdownText from '../../../../components/ui/primitives/CountdownText'
import EvidenceLink from '../../../../components/ui/EvidenceLink'
import { formatDisputeReason } from '../../../../common/utils/memberGroupDisplay'

export default function MemberIssueCard(
  { viewerName, viewerAvatarInitial, viewerAvatarColor, viewerPresenceStatus, issueNote, evidenceUrl, disputeDeadline, isDisputeEscalated }
) {
  const [expanded, setExpanded] = useState(false)
  const isServiceIssueOnly = !disputeDeadline
  const { types: issueTypes, detail: issueDetail } = formatDisputeReason(issueNote)

  const header = (
    <span className="relative inline-block shrink-0">
      <Avatar initial={viewerAvatarInitial} color={viewerAvatarColor} size="sm" />
      <PresenceDot status={viewerPresenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
    </span>
  )

  if (isServiceIssueOnly) {
    return (
      <div className="mt-4 rounded-lg border border-line p-3">
        <div className="flex items-center gap-3">
          {header}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{viewerName}</p>
            <p className="text-xs text-danger-text">問題回報處理中</p>
          </div>
        </div>
        <div className="mt-2 w-full space-y-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">
          <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題說明：</span>{issueNote}</p>
          <EvidenceLink
            url={evidenceUrl}
            className="flex w-fit items-center gap-1 text-xs font-medium text-brand underline hover:text-brand/80"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-line p-3">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-3 text-left">
            {header}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{viewerName}</p>
              <p className="flex flex-wrap items-baseline gap-x-1 text-xs text-danger-text">
                <span>{isDisputeEscalated ? '平台介入處理中' : '問題回報待處理'}</span>
                <span>剩餘 <CountdownText deadline={disputeDeadline} /></span>
              </p>
            </div>
            <ChevronDown size={16} strokeWidth={1.5} className={`shrink-0 text-ink-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 w-full space-y-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">
            <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題類型：</span>{issueTypes}</p>
            {issueDetail && (
              <p className="whitespace-pre-line"><span className="font-semibold text-ink-3">問題說明：</span>{issueDetail}</p>
            )}
            <EvidenceLink
              url={evidenceUrl}
              className="flex w-fit items-center gap-1 text-xs font-medium text-brand underline hover:text-brand/80"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
