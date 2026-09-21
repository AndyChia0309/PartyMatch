import { MessageCircle, Star } from 'lucide-react'
import { Avatar } from '../../../../components/ui/avatar'
import { PresenceDot } from '../../../../common/layout/components/navShared'
import { Button } from '../../../../components/ui/button'
import { toISODate } from '../../../../common/utils/date'

export function buildMembersPanel({ group, members, currentUser, myMember, showReviewHostButton, setActivePanel, onClose, setReviewPrompt }) {
  return {
    content: (
      <div className="p-5 space-y-2">
        <div className="rounded-lg border border-line p-3">
          <div className="flex items-center gap-3">
            <span className="relative inline-block shrink-0">
              <Avatar initial={group.hostAvatarInitial} color={group.hostAvatarColor} size="sm" />
              <PresenceDot status={group.hostPresenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="min-w-0 truncate text-sm font-semibold leading-5 text-ink">
                <span>{group.hostName}</span>
                <span className="ml-1.5 inline-flex h-4 align-[0.05em] items-center rounded-full bg-brand-subtle px-1.5 text-[11px] font-semibold leading-none text-brand">
                  團主
                </span>
              </p>
              <p className="text-xs text-ink-3">{toISODate(group.createdAt)} 建立</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {showReviewHostButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`評價${group.hostName}`}
                  onClick={() => setReviewPrompt({})}
                  className="text-ink-3 hover:text-warning"
                >
                  <Star strokeWidth={1.5} size={20} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`私訊${group.hostName}`}
                onClick={() => {
                  setActivePanel(null)
                  onClose()
                  window.dispatchEvent(new CustomEvent('pm:open-dm', {
                    detail: { hostId: group.hostId, hostName: group.hostName, hostAvatarInitial: group.hostAvatarInitial, hostAvatarColor: group.hostAvatarColor },
                  }))
                }}
                className="text-ink-3 hover:text-brand"
              >
                <MessageCircle strokeWidth={1.5} size={20} />
              </Button>
            </div>
          </div>
        </div>
        {members.filter(m => m.userId !== currentUser?.id).map(m => (
          <div key={m.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-3">
              <span className="relative inline-block shrink-0">
                <Avatar initial={m.userAvatarInitial} color={m.userAvatarColor} size="sm" />
                <PresenceDot status={m.userPresenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{m.userName}</p>
                <p className="text-xs text-ink-3">{m.joinedAt} 加入</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`私訊${m.userName}`}
                onClick={() => {
                  setActivePanel(null)
                  onClose()
                  window.dispatchEvent(new CustomEvent('pm:open-dm', {
                    detail: { hostId: m.userId, hostName: m.userName, hostAvatarInitial: m.userAvatarInitial, hostAvatarColor: m.userAvatarColor },
                  }))
                }}
                className="text-ink-3 hover:text-brand"
              >
                <MessageCircle strokeWidth={1.5} size={20} />
              </Button>
            </div>
          </div>
        ))}
        {myMember && (
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-3">
              <span className="relative inline-block shrink-0">
                <Avatar initial={myMember.userAvatarInitial} color={myMember.userAvatarColor} size="sm" />
                <PresenceDot status={myMember.userPresenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {myMember.userName}
                  <span className="ml-1.5 text-xs font-normal text-brand">（你）</span>
                </p>
                <p className="text-xs text-ink-3">{myMember.joinedAt} 加入</p>
              </div>
            </div>
          </div>
        )}
      </div>
    ),
  }
}
