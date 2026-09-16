import { KeyRound } from 'lucide-react'
import { Avatar } from '../../../../components/ui/avatar'
import { PresenceDot } from '../../../../common/layout/components/navShared'
import CredentialCommentsSection from '../../../../components/ui/group/CredentialCommentsSection'
import MemberIssueCard from './MemberIssueCard'
import { CredentialsValue, CredentialsPrivacyNote, MemberProvidedCredentialsValue } from './SharedCredentialsValue'

export function buildCredentialsPanel(
  {
    group, viewerName, viewerAvatarInitial, viewerAvatarColor, viewerPresenceStatus, showPassword, onTogglePassword,
    issueNote, evidenceUrl, disputeDeadline, memberProfiles, isSharedCredentials, hasExtracted, memberServiceInfo, memberServiceFields, isDisputeEscalated,
    autoScrollToComments,
  }
) {
  const credentialsBody = (
    <div className="p-5">
      <p className="mb-2 flex items-center gap-1.5 text-base font-black text-ink"><KeyRound size={15} strokeWidth={1.5} />帳號資訊</p>
      {isSharedCredentials ? (
        hasExtracted ? (
          <CredentialsValue group={group} viewerName={viewerName} showPassword={showPassword} onTogglePassword={onTogglePassword} />
        ) : (
          <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-4">尚未提取帳號資訊</p>
        )
      ) : (
        <MemberProvidedCredentialsValue serviceInfo={memberServiceInfo} fields={memberServiceFields} />
      )}
      {memberProfiles?.length > 0 && (
        <div className="mt-3 space-y-2">
          {memberProfiles.map(({ id, userName, userAvatarInitial, userAvatarColor, userPresenceStatus, profileName, extractionStartedAt, isSelf }) => (
            <div key={id} className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-3">
                <span className="relative inline-block shrink-0">
                  <Avatar initial={userAvatarInitial} color={userAvatarColor} size="sm" />
                  <PresenceDot status={userPresenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{userName}{isSelf ? '（你）' : ''}</p>
                  {!profileName && (
                    <p className={`text-xs ${extractionStartedAt ? 'text-info-text' : 'text-ink-4'}`}>
                      {extractionStartedAt ? '已查看帳號資訊' : '尚未提取帳號'}
                    </p>
                  )}
                </div>
              </div>
              {profileName && (
                <dl className="mt-2 rounded-lg border border-line px-3 py-2">
                  <div className="flex items-baseline gap-2 text-xs">
                    <dt className="shrink-0 text-ink-4">Profile 名稱：</dt>
                    <dd className="min-w-0 truncate text-ink-2">{profileName}</dd>
                  </div>
                </dl>
              )}
            </div>
          ))}
        </div>
      )}
      <CredentialsPrivacyNote visible={!!group.sharedCredentials} />
      {issueNote && (
        <MemberIssueCard
          viewerName={viewerName}
          viewerAvatarInitial={viewerAvatarInitial}
          viewerAvatarColor={viewerAvatarColor}
          viewerPresenceStatus={viewerPresenceStatus}
          issueNote={issueNote}
          evidenceUrl={evidenceUrl}
          disputeDeadline={disputeDeadline}
          isDisputeEscalated={isDisputeEscalated}
        />
      )}
      <CredentialCommentsSection groupId={group.id} hostId={group.hostId} autoScroll={autoScrollToComments} />
    </div>
  )

  return { content: credentialsBody }
}
