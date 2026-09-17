import { memo } from 'react'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { getStatusTextColor } from '../../../components/ui/statusBadgeConfig'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import GroupCardHeader from '../../../components/ui/group/GroupCardHeader'
import { StatCell, StatCellGrid } from '../../../components/ui/group/StatCellGrid'
import { getRenewalAwareStatus } from '../../../common/utils/groupStatusDisplay'
import { getHostStatusBadge, getHostGroupStatusLabel } from '../../../common/utils/hostGroupDisplay'
import { toISODate } from '../../../common/utils/date'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { isSharedCredentialsMethod } from '../../../common/utils/serviceInfoFields'
import { UpdateDot } from '../../../common/layout/components/navShared'

function HostedGroupCard({
  group,
  members,
  pendingAppCount,
  paymentCount,
  hasPendingUpdate,
  onViewGroup,
}) {
  const displayStatus = getRenewalAwareStatus(group.status, group.nextBillingDate)
  const isSharedCredentials = isSharedCredentialsMethod(getServiceById(group.serviceId)?.sharingMethod)

  const collectionState = getHostGroupStatusLabel(group.status)

  const collectionHighlight = {
    '服務中':    'text-success-text',
    '招募中':    'text-success-text',
    '已結束':    'text-ink-3',
    '已滿員':    'text-ink-3',
    '確認期中':  getStatusTextColor('confirming'),
    '問題處理中': getStatusTextColor('disputed'),
  }[collectionState] ?? 'text-warning-text';

  const isActivated    = ['active', 'cancelled', 'ended'].includes(group.status)

  return (
    <Card
      as="article"
      className="card-lift relative flex min-h-full cursor-pointer flex-col overflow-hidden p-5"
      onClick={onViewGroup}
    >
      <GroupCardHeader
        badge={
          <StatusBadge
            status={displayStatus}
            label={getHostStatusBadge(group.status, isSharedCredentials)?.label}
          />
        }
        serviceId={group.serviceId}
        serviceName={group.serviceName}
        planName={group.planName}
        pricePerSeat={group.pricePerSeat}
        billingCycle={group.billingCycle}
      />
      <StatCellGrid>
        {group.status === 'active' ? (
          <StatCell label="群組狀態" highlight={collectionHighlight}>
            {collectionState}
          </StatCell>
        ) : isActivated ? (
          <StatCell label="收款紀錄">
            {paymentCount} 件
          </StatCell>
        ) : group.status === 'recruiting' ? (
          <StatCell
            label="待處理申請"
            highlight={pendingAppCount > 0 ? 'text-brand' : undefined}
          >
            {pendingAppCount} 件
          </StatCell>
        ) : (
          <StatCell label="群組狀態" highlight={collectionHighlight}>
            {collectionState}
          </StatCell>
        )}
        <StatCell label="群組人數">
          {members.length + 1} 人
        </StatCell>
        {group.status === 'active' ? (
          <StatCell label="續訂日期">
            {toISODate(group.nextBillingDate, '—')}
          </StatCell>
        ) : group.status === 'recruiting' || group.status === 'cancelled' || group.status === 'ended' ? (
          <StatCell label="建立日期">
            {toISODate(group.createdAt, '—')}
          </StatCell>
        ) : isActivated ? (
          <StatCell label="群組狀態" highlight={collectionHighlight}>
            {collectionState}
          </StatCell>
        ) : group.status === 'pending_confirmation' || group.status === 'pending_activation' ? (
          <StatCell label="扣款日期">
            啟用後確定
          </StatCell>
        ) : (
          <StatCell label="扣款日期">
            {toISODate(group.nextBillingDate, '—')}
          </StatCell>
        )}
      </StatCellGrid>
      <div className="mt-auto pt-5">
        <div className="relative">
          <Button
            onClick={e => { e.stopPropagation(); onViewGroup?.() }}
            className="w-full"
          >
            查看群組
          </Button>
          <UpdateDot show={hasPendingUpdate} />
        </div>
      </div>
    </Card>
  );
}

export default memo(HostedGroupCard, (prev, next) =>
  prev.group.id === next.group.id &&
  prev.group.status === next.group.status &&
  prev.group.usedSeats === next.group.usedSeats &&
  prev.group.openSeats === next.group.openSeats &&
  prev.group.nextBillingDate === next.group.nextBillingDate &&
  prev.pendingAppCount === next.pendingAppCount &&
  prev.paymentCount === next.paymentCount &&
  prev.hasPendingUpdate === next.hasPendingUpdate &&
  prev.members.length === next.members.length &&
  prev.onViewGroup === next.onViewGroup
)
