import { Eye, EyeOff, FileText, KeyRound } from 'lucide-react'
import EmptyState from '../../../../components/ui/primitives/EmptyState'
import CredentialCommentsSection from '../../../../components/ui/group/CredentialCommentsSection'
import MemberIssueCard from './MemberIssueCard'
import { hasFilledServiceInfo, isSharedCredentialsMethod } from '../../../../common/utils/serviceInfoFields'
import { parseHostCredentials } from '../../../../common/utils/hostCredentialFields'

export function buildMemberInfoPanel(
  { groupId, hostId, groupStatus, members, sharingMethod, sharedCredentials, serviceId, canReportServiceIssue, onOpenServiceIssue, onResolveDispute, onEscalateDispute, onRejectWithdrawal, showPassword, onTogglePassword, autoExpandMemberId, autoScrollToComments, onAutoScrollToCommentsDone }
) {
  const parsedCredentials = parseHostCredentials(sharedCredentials, serviceId)
  const isSharedCredentials = isSharedCredentialsMethod(sharingMethod)
  return {
    content: (
      <div className="flex flex-col px-5 pb-5 pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-base font-black text-ink"><KeyRound size={15} strokeWidth={1.5} />帳號資訊</p>
        {isSharedCredentials && (
          <div className="mb-3 py-3">
            {parsedCredentials ? (
              <dl className="space-y-1 rounded-lg border border-line px-3 py-2.5">
                {parsedCredentials.map(({ key, label, value }) => (
                  <div key={label} className="flex items-baseline justify-between gap-2 text-sm">
                    <dt className="shrink-0 text-ink-4">{label}</dt>
                    {key === 'password' ? (
                      <dd className="flex min-w-0 items-center gap-1.5 text-right text-brand dark:text-white">
                        <span className="truncate">{showPassword ? value : '••••••••'}</span>
                        <button
                          type="button"
                          onClick={onTogglePassword}
                          className="shrink-0 rounded-control p-1 text-ink-4 transition-colors hover:bg-surface hover:text-ink-2"
                        >
                          {showPassword ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                        </button>
                      </dd>
                    ) : (
                      <dd className="min-w-0 truncate text-right text-brand dark:text-white">{value}</dd>
                    )}
                  </div>
                ))}
              </dl>
            ) : sharedCredentials ? (
              <p className="whitespace-pre-wrap rounded-lg border border-line px-3 py-2.5 text-sm text-brand dark:text-white">{sharedCredentials}</p>
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-4">尚未提供</p>
            )}
          </div>
        )}
        {members.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <EmptyState icon={FileText} title="目前尚無成員" />
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => {
              const canResolve = groupStatus === 'disputed' && !!m.serviceInfoIssueNote && !m.disputeEscalatedAt
              return (
                <MemberIssueCard
                  key={m.id}
                  m={m}
                  filled={hasFilledServiceInfo(m.serviceInfo, sharingMethod, serviceId)}
                  sharingMethod={sharingMethod}
                  serviceId={serviceId}
                  isSharedCredentials={isSharedCredentials}
                  canReportServiceIssue={canReportServiceIssue}
                  onOpenServiceIssue={onOpenServiceIssue}
                  canResolve={canResolve}
                  onResolveDispute={onResolveDispute}
                  onEscalateDispute={onEscalateDispute}
                  onRejectWithdrawal={onRejectWithdrawal}
                  autoExpand={m.id === autoExpandMemberId}
                />
              )
            })}
          </div>
        )}
        <CredentialCommentsSection groupId={groupId} hostId={hostId} autoScroll={autoScrollToComments} onAutoScrolled={onAutoScrollToCommentsDone} />
      </div>
    ),
  }
}
