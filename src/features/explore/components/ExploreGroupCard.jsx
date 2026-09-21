import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import FavoriteToggleButton from '../../../components/ui/FavoriteToggleButton'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { getStatusLabel } from '../../../components/ui/statusBadgeConfig'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import GroupCardHeader from '../../../components/ui/group/GroupCardHeader'
import { StatCell, StatCellGrid } from '../../../components/ui/group/StatCellGrid'
import CreditScoreValue from '../../../components/ui/CreditScoreValue'
import { useFavoriteStore } from '../../../common/stores/useFavoriteStore'
import { useAuthStore } from '../../../common/stores/useAuthStore'
import { toast } from '../../../common/utils/toast'
import { LOCKED_MESSAGE } from '../../../common/layout/components/navConstants'
import { getMemberJoinedBadgeVariant } from '../../../common/utils/memberGroupDisplay'

const RANK_BADGE_STYLES = [
  'bg-amber-400 text-white',
  'bg-line-strong text-ink-2',
  'bg-orange-300 text-white',
]

function ExploreGroupCard({ group, onFavChange, onBeforeNavigate, hideActions = false, isApplied = false, isMember = false, rank }) {
  const navigate = useNavigate()
  const activeUser = useAuthStore(s => s.user)
  const isFav = useFavoriteStore(s => activeUser ? s.isFavorited(activeUser.id, group.id) : false)

  const isLastSeat = group.openSeats === 1

  function openDetails(e) {
    e.stopPropagation()
    onBeforeNavigate?.()
    window.dispatchEvent(new CustomEvent('pm:open-group', { detail: { groupId: group.id } }))
  }

  function handleFav(e) {
    e.stopPropagation()
    if (!activeUser) {
      toast(LOCKED_MESSAGE, 'info', {
        action: { label: '前往登入', onClick: () => { onBeforeNavigate?.(); navigate('/login') } },
      })
      return
    }
    const next = useFavoriteStore.getState().toggle(activeUser.id, group.id)
    onFavChange?.(next, group.id)
  }

  return (
    <Card
      as="article"
      className="card-lift relative flex min-h-full cursor-pointer flex-col overflow-hidden p-5"
      onClick={openDetails}
    >
      <GroupCardHeader
        topLeftSlot={rank != null && (
          <span className={`absolute left-4 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold shadow-floating ${RANK_BADGE_STYLES[rank - 1] ?? RANK_BADGE_STYLES[2]}`}>
            {rank}
          </span>
        )}
        topRightSlot={!hideActions && (
          <FavoriteToggleButton
            isFav={isFav}
            onClick={handleFav}
            heartSize={18}
            className="absolute right-7 top-4 h-9 w-9 shadow-floating"
          />
        )}
        badge={(isMember || isApplied) && (
          <StatusBadge
            status={isMember ? (getMemberJoinedBadgeVariant(group.status, isMember) ?? 'full') : 'approval'}
          />
        )}
        serviceId={group.serviceId}
        serviceName={group.serviceName}
        planName={group.planName}
        pricePerSeat={group.pricePerSeat}
        billingCycle={group.billingCycle}
      />

      <div className="mx-2">
        <StatCellGrid>
          <StatCell label="團主">{group.hostName ?? '—'}</StatCell>
          <StatCell label="剩餘名額">
            {group.totalSeats == null ? (
              '—'
            ) : group.openSeats <= 0 ? (
              <span className="text-ink-3">{getStatusLabel('full')}</span>
            ) : (
              <>
                <span className={isLastSeat ? 'text-warning-text' : 'text-success'}>{group.openSeats}</span>
                <span className="text-ink-4"> / {group.totalSeats}</span>
              </>
            )}
          </StatCell>
          <StatCell label="信用分數"><CreditScoreValue score={group.minCreditScore} /></StatCell>
        </StatCellGrid>
      </div>

      {!hideActions && (
        <div className="mx-2 mt-auto pt-5">
          <Button onClick={openDetails} className="w-full">
            查看詳情
          </Button>
        </div>
      )}
    </Card>
  )
}

export default memo(ExploreGroupCard, (prev, next) =>
  prev.group.id === next.group.id &&
  prev.group.status === next.group.status &&
  prev.group.openSeats === next.group.openSeats &&
  prev.group.usedSeats === next.group.usedSeats &&
  prev.group.totalSeats === next.group.totalSeats &&
  prev.group.pricePerSeat === next.group.pricePerSeat &&
  prev.group.planName === next.group.planName &&
  prev.isApplied === next.isApplied &&
  prev.isMember === next.isMember &&
  prev.hideActions === next.hideActions &&
  prev.rank === next.rank &&
  prev.onFavChange === next.onFavChange &&
  prev.onBeforeNavigate === next.onBeforeNavigate
)
