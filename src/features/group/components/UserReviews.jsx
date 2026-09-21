import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Star } from 'lucide-react'
import { AvatarWithPresence, Avatar } from '../../../components/ui/avatar'
import StarRating from '../../../components/ui/primitives/StarRating'
import CreditScoreBadge from '../../../components/ui/CreditScoreBadge'
import EmptyState from '../../../components/ui/primitives/EmptyState'
import { CENTERED_PANEL_BODY_CLASS } from '../../../components/ui/group/panelLayout'
import { useReviewStore } from '../../../common/stores/useReviewStore'
import { getUserProfile } from '../../../common/api/usersApi'
import { toISODate } from '../../../common/utils/date'

export default function UserReviews({
  userId, userName, avatarInitial, avatarColor, presenceStatus, bio, roleLabel,
  headerClassName, onDm, groupId, title = '評價', scrollable = false, centerEmpty = false, topPadding = true, squareDmButton = false,
}) {
  const data = useReviewStore(s => s.byUserId[userId])
  const fetchForUser = useReviewStore(s => s.fetchForUser)
  const [creditScore, setCreditScore] = useState(null)

  useEffect(() => {
    if (userId) fetchForUser(userId)
  }, [userId, fetchForUser])

  useEffect(() => {
    let active = true
    if (userId) {
      getUserProfile(userId)
        .then(u => { if (active) setCreditScore(u.creditScore) })
        .catch(() => { if (active) setCreditScore(null) })
    }
    return () => { active = false }
  }, [userId]);

  const reviews = useMemo(() => {
    const all = data?.reviews ?? []
    return groupId ? all.filter(r => r.groupId === groupId) : all
  }, [data?.reviews, groupId]);
  const { average, count } = useMemo(() => {
    if (!groupId) return { average: data?.average ?? null, count: data?.count ?? 0 }
    return {
      average: reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null,
      count: reviews.length,
    }
  }, [groupId, reviews, data?.average, data?.count]);

  const emptyOrLoading = data?.loading
    ? <p className="py-4 text-center text-sm text-ink-4">載入中…</p>
    : reviews.length === 0
      ? <EmptyState icon={Star} title="尚無評價" description="評價會顯示在這裡。" className="py-4" />
      : null

  const showHeader = !(centerEmpty && emptyOrLoading);

  return (
    <div className={centerEmpty ? `flex min-h-0 flex-1 flex-col space-y-4 ${CENTERED_PANEL_BODY_CLASS}` : `space-y-4 pb-5 ${topPadding ? 'pt-5' : 'pt-0'}`}>
      {title && (
        <p className={`flex items-center gap-2 ${headerClassName}`}>
          <Star size={16} strokeWidth={1.5} className="shrink-0 text-brand" />
          {title}
        </p>
      )}
      {showHeader && (
        <div className="flex items-center gap-3 border-b border-line-subtle pb-4">
          <AvatarWithPresence initial={avatarInitial} color={avatarColor} size="md" presenceStatus={presenceStatus} dotClassName="h-3 w-3" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-sm font-semibold text-ink">{userName}</p>
              {roleLabel && (
                <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-brand-subtle px-2 text-xs font-semibold leading-none text-brand">
                  {roleLabel}
                </span>
              )}
              {creditScore != null && <CreditScoreBadge score={creditScore} />}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {average != null ? (
                <>
                  <Star size={13} strokeWidth={1.5} className="fill-warning text-warning" />
                  <span className="text-xs font-bold text-ink-2">{average.toFixed(1)} 分</span>
                  <span className="text-xs text-ink-4">· {count} 則評價</span>
                </>
              ) : (
                <span className="text-xs text-ink-4">尚無評價</span>
              )}
            </div>
          </div>
          {onDm && (
            <button
              onClick={onDm}
              className={`grid h-10 w-10 shrink-0 place-items-center border border-line text-ink-3 transition-colors hover:border-brand hover:text-brand ${squareDmButton ? 'rounded-lg' : 'rounded-full'}`}
              aria-label={`聯絡${userName}`}
            >
              <MessageCircle size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}
      {showHeader && bio && (
        <p className="whitespace-pre-wrap border-b border-line-subtle pb-4 text-sm leading-relaxed text-ink-3">{bio}</p>
      )}
      {emptyOrLoading ? (
        centerEmpty ? <div className="flex flex-1 items-center justify-center">{emptyOrLoading}</div> : emptyOrLoading
      ) : (
        <div className={`space-y-4 ${scrollable ? 'max-h-[15rem] overflow-y-auto pr-1' : ''}`}>
          {reviews.map(review => (
            <div key={review.id} className="flex gap-3">
              <Avatar initial={review.author?.avatarInitial} color={review.author?.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{review.author?.name ?? '匿名使用者'}</span>
                    {review.author?.creditScore != null && <CreditScoreBadge score={review.author.creditScore} />}
                  </span>
                  <span className="shrink-0 text-xs text-ink-4">{toISODate(review.createdAt)}</span>
                </div>
                {!groupId && (review.group?.planName || review.group?.service?.name) && (
                  <p className="mb-1 text-xs text-ink-4">
                    來自：{review.group?.planName ?? review.group?.service?.name}
                  </p>
                )}
                <div className="mb-1">
                  <StarRating value={review.rating} readOnly />
                </div>
                {review.comment && <p className="text-sm leading-relaxed text-ink-3">{review.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
