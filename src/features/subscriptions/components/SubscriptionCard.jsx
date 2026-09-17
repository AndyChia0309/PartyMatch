import { memo } from 'react'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import GroupCardHeader from '../../../components/ui/group/GroupCardHeader'
import { StatCell, StatCellGrid } from '../../../components/ui/group/StatCellGrid'
import { toISODate } from '../../../common/utils/date'
import { getRenewalAwareStatus } from '../../../common/utils/groupStatusDisplay'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { getSubscriptionBadgeStatus, getSubscriptionBillingDisplay, getSubscriptionCardBadge } from '../../../common/utils/memberGroupDisplay'
import { UpdateDot } from '../../../common/layout/components/navShared'

function SubscriptionCard({ sub, hasPendingUpdate, onViewGroup }) {
  const badgeStatus   = getSubscriptionBadgeStatus(sub)
  const displayStatus = getRenewalAwareStatus(badgeStatus, sub.nextBillingDate)
  const isActive      = badgeStatus === 'active'
  const memberCount   = sub.usedSeats ?? 0

  const rawStatus = sub.groupStatus ?? sub.status;
  const { isPreBillingLock, showsBillingDate } = getSubscriptionBillingDisplay(rawStatus)

  const sharingMethod = getServiceById(sub.serviceId)?.sharingMethod;
  const badge = getSubscriptionCardBadge(sub, { sharingMethod, displayStatus })

  return (
    <Card
      as="article"
      className="card-lift relative flex min-h-full cursor-pointer flex-col overflow-hidden p-5"
      onClick={() => onViewGroup?.(sub)}
    >
      <GroupCardHeader
        badge={
          <StatusBadge status={badge.status} label={badge.label} />
        }
        serviceId={sub.serviceId}
        serviceName={sub.serviceName}
        planName={sub.planName}
        pricePerSeat={sub.pricePerSeat}
        billingCycle={sub.billingCycle}
      />

      <StatCellGrid>
        <StatCell label="團主">{sub.hostName ?? '—'}</StatCell>
        <StatCell label="群組人數">{memberCount} 人</StatCell>
        {isActive ? (
          <StatCell label="下期收費">{toISODate(sub.nextBillingDate, '—')}</StatCell>
        ) : isPreBillingLock ? (
          <StatCell label="扣款日期">啟用後確定</StatCell>
        ) : showsBillingDate ? (
          <StatCell label="扣款日期">{toISODate(sub.nextBillingDate, '—')}</StatCell>
        ) : (
          <StatCell label="加入日期">{sub.joinedAt ?? '—'}</StatCell>
        )}
      </StatCellGrid>

      <div className="mt-auto pt-5">
        <div className="relative">
          <Button onClick={e => { e.stopPropagation(); onViewGroup?.(sub) }} className="w-full">
            查看群組
          </Button>
          <UpdateDot show={hasPendingUpdate} />
        </div>
      </div>
    </Card>
  )
}

export default memo(SubscriptionCard, (prev, next) =>
  prev.sub.id === next.sub.id &&
  prev.sub.groupStatus === next.sub.groupStatus &&
  prev.sub.confirmedAt === next.sub.confirmedAt &&
  prev.sub.nextBillingDate === next.sub.nextBillingDate &&
  prev.sub.serviceInfo === next.sub.serviceInfo &&
  prev.sub.serviceInfoIssueNote === next.sub.serviceInfoIssueNote &&
  prev.hasPendingUpdate === next.hasPendingUpdate &&
  prev.onViewGroup === next.onViewGroup
)
