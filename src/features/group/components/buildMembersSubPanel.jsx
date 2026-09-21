import { MessageCircle, Users } from 'lucide-react'
import { AvatarWithPresence } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import { toISODate } from '../../../common/utils/date'

export function buildMembersSubPanel({ group, groupId, members, activeUserId, setShowMembers, openDm }) {
  const groupMembers = members.filter(m => m.groupId === groupId)
  return {
    title: `群組名單（${groupMembers.filter(m => m.userId !== group.hostId).length + 1} 人）`,
    icon: <Users strokeWidth={1.5} size={18} className="text-brand" />,
    content: (
      <div className="p-5 space-y-2">
        <div className="rounded-lg border border-line p-3">
          <div className="flex items-center gap-3">
            <AvatarWithPresence initial={group.hostAvatarInitial} color={group.hostAvatarColor} size="sm" presenceStatus={group.hostPresenceStatus} dotClassName="h-2.5 w-2.5" />
            <div className="min-w-0 flex-1">
              <p className="min-w-0 truncate text-sm font-semibold leading-5 text-ink">
                <span>{group.hostName}</span>
                <span className="ml-1.5 inline-flex h-4 align-[0.05em] items-center rounded-full bg-brand-subtle px-1.5 text-[11px] font-semibold leading-none text-brand">
                  團主
                </span>
              </p>
              <p className="text-xs text-ink-3">{toISODate(group.createdAt)} 建立</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`私訊${group.hostName}`}
              onClick={() => { setShowMembers(false); openDm() }}
              className="text-ink-3 hover:text-brand"
            >
              <MessageCircle strokeWidth={1.5} size={20} />
            </Button>
          </div>
          {group.hostBio && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-3">{group.hostBio}</p>}
        </div>
        {groupMembers.map(m => (
          <div key={m.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-3">
              <AvatarWithPresence initial={m.userAvatarInitial} color={m.userAvatarColor} size="sm" presenceStatus={m.userPresenceStatus} dotClassName="h-2.5 w-2.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {m.userName}
                  {m.userId === activeUserId && <span className="ml-1.5 text-xs font-normal text-brand">（你）</span>}
                </p>
                <p className="text-xs text-ink-3">{m.joinedAt} 加入</p>
              </div>
            </div>
            {m.userBio && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-3">{m.userBio}</p>}
          </div>
        ))}
      </div>
    ),
  }
}
