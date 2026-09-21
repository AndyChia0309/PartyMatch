import { KeyRound } from 'lucide-react'
import CredentialCommentsSection from '../../../../components/ui/group/CredentialCommentsSection'
import MemberAccountStatusRow from './MemberAccountStatusRow'
import { CredentialsValue, CredentialsPrivacyNote, MemberProvidedCredentialsValue } from './SharedCredentialsValue'

export function buildCredentialsPanel(
  {
    group, viewerName, showPassword, onTogglePassword,
    memberStatuses, isSharedCredentials, hasExtracted, memberServiceInfo, memberServiceFields,
    autoScrollToComments, onAutoScrollToCommentsDone,
  }
) {
  const hasMemberStatuses = memberStatuses?.length > 0

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
        <>
          <p className="mb-1.5 text-xs font-semibold text-ink-3">我提供的帳號資訊</p>
          <MemberProvidedCredentialsValue serviceInfo={memberServiceInfo} fields={memberServiceFields} />
        </>
      )}
      {hasMemberStatuses && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-ink-3">成員帳號狀態</p>
          {memberStatuses.map(member => (
            <MemberAccountStatusRow key={member.id} member={member} isSharedCredentials={isSharedCredentials} />
          ))}
        </div>
      )}
      <CredentialsPrivacyNote visible={!!group.sharedCredentials} />
      <CredentialCommentsSection groupId={group.id} hostId={group.hostId} autoScroll={autoScrollToComments} onAutoScrolled={onAutoScrollToCommentsDone} />
    </div>
  )

  return { content: credentialsBody }
}
