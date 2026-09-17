import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react'
import { AvatarWithPresence } from '../../../../components/ui/avatar'
import { Button } from '../../../../components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../../../components/ui/collapsible'
import CountdownText from '../../../../components/ui/primitives/CountdownText'
import EvidenceLink from '../../../../components/ui/EvidenceLink'
import DisputeResponseModal from './DisputeResponseModal'
import { getTextFields } from '../../../../common/utils/serviceInfoFields'
import { formatDisputeReason } from '../../../../common/utils/memberGroupDisplay'
import { useClickOutside } from '../../../../common/utils/hooks'

function renderFilledInfoDetail(serviceInfo, sharingMethod, serviceId) {
  const textFields = getTextFields(sharingMethod, serviceId)

  if (textFields.length === 0) {
    return <p className="text-xs text-success-text">已確認取得帳號資訊</p>;
  }

  return (
    <dl className="space-y-1">
      {textFields.map(({ key, label }) => (
        <div key={key} className="flex items-baseline gap-2 text-xs">
          <dt className="shrink-0 text-ink-4">{label}</dt>
          <dd className="min-w-0 truncate text-brand dark:text-white">{serviceInfo[key] || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function MemberIssueCard(
  {
    m, filled, sharingMethod, serviceId, isSharedCredentials, canReportServiceIssue, onOpenServiceIssue,
    canResolve, onResolveDispute, onEscalateDispute, autoExpand = false,
  }
) {
  const [expanded, setExpanded] = useState(autoExpand)
  const [responseModal, setResponseModal] = useState(null)
  const cardRef = useRef(null)
  const evidenceUrl = m.disputeEvidenceUrl ?? m.serviceInfoIssueEvidenceUrl
  const hasIssue = !!m.serviceInfoIssueNote
  const showReportButton = canReportServiceIssue && filled && !hasIssue
  const { types: issueTypes, detail: issueDetail } = formatDisputeReason(m.serviceInfoIssueNote)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoExpand) setExpanded(true)
  }, [autoExpand])

  useClickOutside(expanded, [cardRef], () => setExpanded(false))

  async function handleSubmitResponse(note) {
    if (responseModal === 'resolve') await onResolveDispute?.(m.id, note)
    else await onEscalateDispute?.(m.id, note)
    setResponseModal(null)
  }

  return (
    <div ref={cardRef} className="relative rounded-lg border border-line p-3">
      {showReportButton && (
        <Button
          variant="ghost"
          onClick={() => onOpenServiceIssue(m)}
          className="absolute right-3 top-3 h-auto rounded-lg border border-warning/60 px-2.5 py-1 text-xs text-warning-text hover:bg-warning-subtle"
        >
          <AlertTriangle strokeWidth={1.5} size={11} /> 帳號問題
        </Button>
      )}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        {hasIssue ? (
          <CollapsibleTrigger asChild>
            <button type="button" className={`flex w-full items-center gap-3 text-left ${showReportButton ? 'pr-24' : ''}`}>
              <AvatarWithPresence initial={m.userAvatarInitial} color={m.userAvatarColor} size="sm" presenceStatus={m.userPresenceStatus} dotClassName="h-2.5 w-2.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{m.userName}</p>
                <p className="flex flex-wrap items-baseline gap-x-1 text-xs text-danger-text">
                  <span>{m.disputeEscalatedAt ? '平台介入處理中' : '帳號問題待處理'}</span>
                  {m.disputeDeadline && (
                    <span>剩餘 <CountdownText deadline={m.disputeDeadline} /></span>
                  )}
                </p>
              </div>
              <ChevronDown size={16} strokeWidth={1.5} className={`shrink-0 text-ink-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
        ) : (
          <div className={`flex items-center gap-3 ${showReportButton ? 'pr-24' : ''}`}>
            <AvatarWithPresence initial={m.userAvatarInitial} color={m.userAvatarColor} size="sm" presenceStatus={m.userPresenceStatus} dotClassName="h-2.5 w-2.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{m.userName}</p>
              {!filled && (
                <p className={`text-xs ${isSharedCredentials && m.extractionStartedAt ? 'text-info-text' : 'text-ink-4'}`}>
                  {isSharedCredentials
                    ? (m.extractionStartedAt ? '成員已查看帳號資訊' : '尚未提取帳號')
                    : '尚未填寫帳號'}
                </p>
              )}
              {filled && m.confirmedAt && (
                <p className="flex items-center gap-1 text-xs text-success-text">
                  <CheckCircle2 size={11} strokeWidth={1.5} /> 已確認服務
                </p>
              )}
              {filled && !m.confirmedAt && m.confirmDeadline && (
                <p className="flex items-center gap-1 text-xs text-info-text">
                  <CheckCircle2 size={11} strokeWidth={1.5} /> 確認期剩餘 <CountdownText deadline={m.confirmDeadline} />
                </p>
              )}
              {filled && !m.confirmedAt && !m.confirmDeadline && (
                <p className="flex items-center gap-1 text-xs text-success-text">
                  <CheckCircle2 size={11} strokeWidth={1.5} /> {isSharedCredentials ? '已成功提取帳號' : '已填寫服務帳號'}
                </p>
              )}
            </div>
          </div>
        )}
        {filled && (
          <div className="mt-2 rounded-lg border border-line px-3 py-2">
            {renderFilledInfoDetail(m.serviceInfo, sharingMethod, serviceId)}
          </div>
        )}
        {hasIssue && (
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
        )}
      </Collapsible>
      {canResolve && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            variant="success"
            onClick={() => setResponseModal('resolve')}
            className="rounded-lg text-xs"
          >
            處理完成
          </Button>
          <Button
            variant="destructive"
            onClick={() => setResponseModal('escalate')}
            className="rounded-lg text-xs"
          >
            不實回報
          </Button>
        </div>
      )}
      {responseModal && (
        <DisputeResponseModal
          isOpen
          mode={responseModal}
          issueTypes={issueTypes}
          issueDetail={issueDetail}
          evidenceUrl={evidenceUrl}
          onClose={() => setResponseModal(null)}
          onSubmit={handleSubmitResponse}
        />
      )}
    </div>
  )
}
