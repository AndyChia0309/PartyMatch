import { Avatar } from './avatar'
import EvidenceLink from './EvidenceLink'
import { PresenceDot } from '../../common/layout/components/navShared'
import { formatRelativeDate } from '../../common/utils/date'

export default function ReadonlyMessageList({ items, hostId, emptyText = '目前沒有內容', className = '' }) {
  if (items.length === 0) {
    return <p className={`py-4 text-center text-xs text-ink-4 ${className}`}>{emptyText}</p>
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-2">
          <span className="relative inline-block shrink-0">
            <Avatar initial={item.avatarInitial} color={item.avatarColor} size="xs" className="text-2xs" />
            <PresenceDot status={item.presenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2 w-2" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <p className="truncate text-xs font-semibold text-ink">{item.authorName ?? '使用者'}</p>
              {item.authorId === hostId && (
                <span className="shrink-0 self-center rounded-full bg-brand-subtle px-1.5 py-0.5 text-2xs font-semibold leading-none text-brand">團主</span>
              )}
              <p className="shrink-0 text-2xs text-ink-4">{formatRelativeDate(item.createdAt)}</p>
            </div>
            {item.content && <p className="whitespace-pre-wrap break-words text-xs text-ink-2">{item.content}</p>}
            {item.attachmentUrl && (
              <EvidenceLink
                url={item.attachmentUrl}
                className="mt-1 flex w-fit items-center gap-1 text-2xs font-medium text-brand underline hover:text-brand/80"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
