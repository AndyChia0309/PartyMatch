import { ArrowUpCircle, Banknote } from 'lucide-react'
import EmptyState from '../../../../components/ui/primitives/EmptyState'
import EscrowStatusCard from '../../../../components/ui/EscrowStatusCard'
import { formatDateTime } from '../../../../common/utils/date'

const RELEASED_STATUSES = ['active', 'ended']

export function buildPaymentsPanel({ group, member, transactions, transactionsLoading }) {
  const latestEscrow = transactions.find(tx => tx.type === 'escrow') ?? null;
  const latestRefund = transactions.find(tx => tx.type === 'refund') ?? null;
  const isCancelled  = group.status === 'cancelled'
  const isReleased   = RELEASED_STATUSES.includes(group.status)
  const escrowTime = member?.joinedAtTime ?? latestEscrow?.createdAt;

  return {
    content: (
      <div className="p-5">
        {transactionsLoading ? (
          <p className="py-8 text-center text-sm text-ink-3">載入中…</p>
        ) : isCancelled ? (
          latestRefund ? (
            <EscrowStatusCard
              tone="success"
              icon={ArrowUpCircle}
              title="群組已解散，代管金額已退回"
              subtitle={`${formatDateTime(latestRefund.createdAt)} 退回`}
              amount={Math.abs(latestRefund.amount)}
            />
          ) : (
            <EmptyState icon={Banknote} title="目前尚無代管紀錄" />
          )
        ) : !latestEscrow ? (
          <EmptyState icon={Banknote} title="目前尚無代管紀錄" />
        ) : (
          isReleased ? (
            <EscrowStatusCard
              tone="success"
              icon={ArrowUpCircle}
              title="本期費用已撥款給團主"
              subtitle={formatDateTime(escrowTime)}
              amount={Math.abs(latestEscrow.amount)}
            />
          ) : (
            <EscrowStatusCard
              tone="info"
              title="本期費用由平台代管中"
              subtitle={
                member?.confirmedAt
                  ? '你已確認服務，等待其他成員確認後才會撥款給團主'
                  : formatDateTime(escrowTime)
              }
              amount={Math.abs(latestEscrow.amount)}
            />
          )
        )}
      </div>
    ),
  }
}
