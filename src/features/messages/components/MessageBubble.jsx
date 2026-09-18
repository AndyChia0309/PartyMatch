import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Avatar } from '../../../components/ui/avatar'
import ImageLightbox from '../../../components/ui/ImageLightbox'
import { PresenceDot } from '../../../common/layout/components/navShared'
import { useMemberStore } from '../../../common/stores/useMemberStore'
import { hasFilledServiceInfo, getServiceInfoSummary } from '../../../common/utils/serviceInfoFields'
import { getFillServiceInfoDisplay } from '../../../common/utils/messageActionDisplay'
import { formatTime } from '../utils'

const getMemberByUserAndGroup = (uid, gid) => useMemberStore.getState().getByUserAndGroup(uid, gid)

function ReadReceipt({ readers }) {
  if (readers.length === 0) return null
  const label = readers.length === 1 ? '已讀' : `${readers.length} 人已讀`
  const tooltip = `已讀：${readers.join('、')}`
  return (
    <span className="group relative inline-flex text-xs leading-normal text-ink-4" tabIndex={0} title={tooltip}>
      <span className="cursor-default">{label}</span>
      <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 w-max max-w-48 rounded-lg bg-ink px-2 py-1 text-xs leading-relaxed text-canvas opacity-0 shadow-popover transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        {tooltip}
      </span>
    </span>
  )
}

function MessageAttachment({ url }) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 block">
        <img src={url} alt="附件" className="max-h-48 max-w-48 rounded-2xl object-cover" />
      </button>
      {open && <ImageLightbox url={url} onClose={() => setOpen(false)} />}
    </>
  )
}

export default function MessageBubble({ msg, userId, hostId, groupMembers, conversationGroupId, getMessageSenderName, getReadReceiptNames }) {

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="max-w-xs whitespace-pre-line rounded-2xl bg-raised px-4 py-2 text-center text-xs text-ink-3">
          {msg.text}
        </div>
      </div>
    )
  }
  if (msg.type === 'action') {
    if (msg.visibleTo && !msg.visibleTo.includes(userId)) return null
    if (msg.actionType === 'fill_service_info') {
      const fillServiceId = msg.payload?.serviceId
      const myMember = getMemberByUserAndGroup(userId, conversationGroupId);
      const { sharingMethod, isSharedCredentials, iAlreadyFilled } = getFillServiceInfoDisplay({ userId, hostId, fillServiceId, myMember })
      return (
        <div className="flex justify-center">
          <div className="w-72 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="mb-2 text-xs font-semibold text-ink-2">{isSharedCredentials ? '帳號資訊提取進度' : '帳號資訊填寫進度'}</p>
            <div className="space-y-2">
              {groupMembers.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="relative inline-block shrink-0">
                    <Avatar initial={m.userAvatarInitial} color={m.userAvatarColor} size="xs" className="text-2xs" />
                    <PresenceDot status={m.userPresenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2 w-2" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink">{m.userName}</p>
                    {hasFilledServiceInfo(m.serviceInfo, sharingMethod, fillServiceId) ? (
                      <p className="text-xs text-ink-3">{getServiceInfoSummary(m.serviceInfo, sharingMethod, fillServiceId)}</p>
                    ) : (
                      <p className="text-xs text-ink-4">{isSharedCredentials ? '尚未提取' : '尚未填寫'}</p>
                    )}
                  </div>
                  {hasFilledServiceInfo(m.serviceInfo, sharingMethod, fillServiceId) && <CheckCircle2 strokeWidth={1.5} size={13} className="shrink-0 text-success" />}
                </div>
              ))}
            </div>
            {!iAlreadyFilled && (
              <Button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('pm:close-messages'))
                  window.dispatchEvent(new CustomEvent('pm:open-group', {
                    detail: { groupId: conversationGroupId, openCredentials: isSharedCredentials && !myMember?.serviceInfoIssueNote },
                  }))
                }}
                className="mt-3 h-auto w-full rounded-lg px-3 py-1.5 text-xs"
              >
                {isSharedCredentials ? '提取帳號資訊' : '填寫帳號資訊'}
              </Button>
            )}
          </div>
        </div>
      );
    }
    if (msg.actionType === 'all_service_info_filled') {
      return (
        <div className="flex justify-center">
          <div className="w-64 rounded-2xl border border-success/30 bg-success-subtle px-4 py-3 text-center shadow-success">
            <p className="mb-2 text-xs text-ink-2">{msg.text}</p>
            <Button
              variant="success"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('pm:close-messages'))
                window.dispatchEvent(new CustomEvent('pm:open-host-group', { detail: { groupId: conversationGroupId, openBilling: true } }))
              }}
              className="h-auto w-full rounded-lg px-3 py-1.5 text-xs"
            >
              前往收款管理
            </Button>
          </div>
        </div>
      )
    }
    return null
  }
  const isMine = msg.senderId === userId
  if (isMine) {
    const readReceiptNames = getReadReceiptNames(msg)
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%]">


          <div className="ml-auto w-fit rounded-2xl rounded-tr-md border border-brand-hover bg-brand px-4 py-2.5 text-sm text-white">
            {msg.text}
            <MessageAttachment url={msg.attachmentUrl} />
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <span className="text-xs leading-normal text-ink-4">{formatTime(msg.createdAt)}</span>
            <ReadReceipt readers={readReceiptNames} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span className="relative mb-6 inline-block shrink-0">
        <Avatar initial={msg.avatarInitial} color={msg.avatarColor} size="sm" className="text-xs" />
        <PresenceDot status={msg.presenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
      </span>
      <div className="max-w-[70%]">
        <p className="mb-1 text-xs font-bold text-ink-3">{getMessageSenderName(msg)}</p>
        <div className="w-fit rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-card">
          {msg.text}
          <MessageAttachment url={msg.attachmentUrl} />
        </div>
        <p className="mt-1 text-xs text-ink-4">{formatTime(msg.createdAt)}</p>
      </div>
    </div>
  )
}
