import { memo } from 'react'
import { getStatusLabel, getStatusTextColor } from '../../../components/ui/statusBadgeConfig'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import GroupCardHeader from '../../../components/ui/group/GroupCardHeader'
import { StatCell, StatCellGrid } from '../../../components/ui/group/StatCellGrid'
import { getHostGroupFlags, getHostGroupStatusLabel } from '../../../common/utils/hostGroupDisplay'
import { toISODate } from '../../../common/utils/date'
import { UpdateDot } from '../../../common/layout/components/navShared'
import { isRecruitingLike } from '../../../common/utils/groupStatus'

function HostedGroupCard({
  group,
  members,
  hasPendingUpdate,
  onViewGroup,
}) {
  const hasServiceIssue = members.some(m => m.serviceInfoIssueNote)
  const { showRenewal } = getHostGroupFlags(group.status, group.nextBillingDate)

  const collectionState = showRenewal ? getStatusLabel('active_renewal') : getHostGroupStatusLabel(group.status, hasServiceIssue)

  const collectionHighlight = {
    '服務進行中': 'text-success-text',
    '即將續訂':  'text-success-text',
    '招募中':    'text-success-text',
    '補位進行中': 'text-success-text',
    '已解散':    'text-ink-3',
    '已結束服務': 'text-ink-3',
    '尚未鎖定':  'text-ink-3',
    '確認進行中': getStatusTextColor('confirming'),
    '問題處理中': getStatusTextColor('disputed'),
    '帳號處理中': getStatusTextColor('disputed'),
    '啟用逾期':  getStatusTextColor('disputed'),
  }[collectionState] ?? 'text-warning-text';

  const showsBillingDate = !isRecruitingLike(group.status) && !['full', 'cancelled', 'ended'].includes(group.status)
  const isPreBilling = ['pending_confirmation', 'info_overdue', 'pending_activation', 'activation_overdue'].includes(group.status)

  return (
    <Card
      as="article"
      className="card-lift relative flex min-h-full cursor-pointer flex-col overflow-hidden p-5"
      onClick={onViewGroup}
    >
      <GroupCardHeader
        serviceId={group.serviceId}
        serviceName={group.serviceName}
        planName={group.planName}
        pricePerSeat={group.pricePerSeat}
        billingCycle={group.billingCycle}
      />
      <StatCellGrid>
        <StatCell label="群組狀態" highlight={collectionHighlight}>
          {collectionState}
        </StatCell>
        <StatCell label="群組人數">
          {members.length + 1} 人
        </StatCell>
        {showsBillingDate ? (
          <StatCell label="扣款日期">
            {isPreBilling ? '啟用後確定' : toISODate(group.nextBillingDate, '—')}
          </StatCell>
        ) : (
          <StatCell label="建立日期">
            {toISODate(group.createdAt, '—')}
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
  prev.group.createdAt === next.group.createdAt &&
  prev.hasPendingUpdate === next.hasPendingUpdate &&
  prev.members.length === next.members.length &&
  prev.members.filter(m => m.serviceInfoIssueNote).length === next.members.filter(m => m.serviceInfoIssueNote).length &&
  prev.onViewGroup === next.onViewGroup
)
