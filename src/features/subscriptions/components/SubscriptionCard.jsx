import { memo } from 'react'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import GroupCardHeader from '../../../components/ui/group/GroupCardHeader'
import { StatCell, StatCellGrid } from '../../../components/ui/group/StatCellGrid'
import { getStatusLabel, getStatusTextColor } from '../../../components/ui/statusBadgeConfig'
import { toISODate } from '../../../common/utils/date'
import { getMemberGroupBadges, getMemberGroupFlags, getSubscriptionBillingDisplay } from '../../../common/utils/memberGroupDisplay'
import { UpdateDot } from '../../../common/layout/components/navShared'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { isSharedCredentialsMethod } from '../../../common/utils/serviceInfoFields'
import { getRenewalAwareStatus } from '../../../common/utils/groupStatusDisplay'

function getSubscriptionGroupStatusDisplay(status, sub) {
  const serviceDef = getServiceById(sub.serviceId)
  const flags = getMemberGroupFlags({
    status,
    sub,
    myMember: sub,
    hasServiceInfo: sub.hasServiceInfo,
    hasServiceInfoIssue: sub.hasServiceInfoIssue,
    hasGroupServiceInfoIssue: sub.hasGroupServiceInfoIssue,
  })
  const { statusBadgeOverride } = getMemberGroupBadges({
    status,
    sub,
    isSharedCredentials: isSharedCredentialsMethod(serviceDef?.sharingMethod),
    flags,
  })
  const badge = statusBadgeOverride ?? status
  const variant = typeof badge === 'object' ? badge.variant : badge
  return {
    label: typeof badge === 'object' ? (badge.label ?? getStatusLabel(badge.variant)) : getStatusLabel(badge),
    highlight: getStatusTextColor(variant),
  }
}

function SubscriptionCard({ sub, hasPendingUpdate, onViewGroup }) {
  const memberCount   = sub.usedSeats ?? 0

  const rawStatus = sub.groupStatus ?? sub.status;
  const displayStatus = getRenewalAwareStatus(rawStatus, sub.nextBillingDate)
  const { isPreBillingLock, showsBillingDate } = getSubscriptionBillingDisplay(rawStatus)
  const statusDisplay = getSubscriptionGroupStatusDisplay(displayStatus, sub)

  return (
    <Card
      as="article"
      className="card-lift relative flex min-h-full cursor-pointer flex-col overflow-hidden p-5"
      onClick={() => onViewGroup?.(sub)}
    >
      <GroupCardHeader
        serviceId={sub.serviceId}
        serviceName={sub.serviceName}
        planName={sub.planName}
        pricePerSeat={sub.pricePerSeat}
        billingCycle={sub.billingCycle}
      />

      <StatCellGrid>
        <StatCell label="群組狀態" highlight={statusDisplay.highlight}>{statusDisplay.label}</StatCell>
        <StatCell label="群組人數">{memberCount} 人</StatCell>
        {isPreBillingLock ? (
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
  prev.sub.hasServiceInfo === next.sub.hasServiceInfo &&
  prev.sub.hasServiceInfoIssue === next.sub.hasServiceInfoIssue &&
  prev.sub.hasGroupServiceInfoIssue === next.sub.hasGroupServiceInfoIssue &&
  prev.hasPendingUpdate === next.hasPendingUpdate &&
  prev.onViewGroup === next.onViewGroup
)
