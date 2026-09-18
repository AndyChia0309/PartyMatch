import { getSignedDownloadUrl } from './r2Storage.js';

export const HOST_PUBLIC_SELECT = {
  select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true, creditScore: true, bio: true },
};

export function maskGroupListSensitiveFields(groups) {
  return groups.map(g => ({ ...g, sharedCredentials: undefined }))
}

export function maskMemberSensitiveFields(member, { isHost, isSelf }) {
  const hasServiceInfo = member.serviceInfo != null
  const hasServiceInfoIssue = !!member.serviceInfoIssueNote
  if (isHost || isSelf) return { ...member, hasServiceInfo, hasServiceInfoIssue }
  return {
    ...member,
    hasServiceInfo,
    hasServiceInfoIssue,
    serviceInfo: member.serviceInfo?.memberProfileName
      ? { memberProfileName: member.serviceInfo.memberProfileName }
      : undefined,
    serviceInfoIssueNote: undefined,
    serviceInfoIssueEvidenceUrl: undefined,
    disputeEvidenceUrl: undefined,
    disputeDeadline: undefined,
    disputeEscalatedAt: undefined,
  };
}

export async function resolveMemberEvidenceUrls(member) {
  if (!member) return member
  const [serviceInfoIssueEvidenceUrl, disputeEvidenceUrl] = await Promise.all([
    member.serviceInfoIssueEvidenceUrl ? getSignedDownloadUrl(member.serviceInfoIssueEvidenceUrl) : member.serviceInfoIssueEvidenceUrl,
    member.disputeEvidenceUrl ? getSignedDownloadUrl(member.disputeEvidenceUrl) : member.disputeEvidenceUrl,
  ])
  return { ...member, serviceInfoIssueEvidenceUrl, disputeEvidenceUrl }
}

export async function resolveMembersEvidenceUrls(members) {
  return Promise.all(members.map(resolveMemberEvidenceUrls))
}

export function maskGroupDetailSensitiveFields(group, viewerId) {
  if (!group) return group
  const isHost = !!viewerId && group.hostId === viewerId
  const isMember = !!viewerId && Array.isArray(group.members) && group.members.some(m => m.userId === viewerId)
  const isParticipant = isHost || isMember

  const masked = { ...group }
  if (!isParticipant) masked.sharedCredentials = undefined

  if (Array.isArray(group.members)) {
    masked.members = group.members.map(m =>
      maskMemberSensitiveFields(m, { isHost, isSelf: m.userId === viewerId }))
  }
  return masked
}

export async function resolveGroupMemberEvidenceUrls(group) {
  if (!group || !Array.isArray(group.members)) return group
  return { ...group, members: await resolveMembersEvidenceUrls(group.members) }
}
