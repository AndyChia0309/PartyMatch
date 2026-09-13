import { useState } from 'react'
import { ArrowUpCircle, ChevronDown } from 'lucide-react'
import { Avatar } from '../../../../components/ui/avatar'
import { PresenceDot } from '../../../../common/layout/components/navShared'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../../../components/ui/collapsible'
import EscrowStatusCard from '../../../../components/ui/EscrowStatusCard'
import TokenAmount from '../../../../components/ui/TokenAmount'
import { formatDateTime } from '../../../../common/utils/date'
import { buildMemberRows } from '../../../../common/utils/billingRows'

export default function BillingCycleSection({ cycle, isCurrentCycle, transactions: rawTransactions, isCancelled, defaultOpen, pendingApplicantUserIds }) {
  const [open, setOpen] = useState(defaultOpen);

  const transactions = isCurrentCycle && pendingApplicantUserIds?.size
    ? rawTransactions.filter(tx => !(tx.type === 'escrow' && pendingApplicantUserIds.has(tx.userId)))
    : rawTransactions;

  const escrowTotal   = transactions.filter(tx => tx.type === 'escrow').reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const releasedTotal = transactions.filter(tx => tx.type === 'release').reduce((sum, tx) => sum + tx.amount, 0)
  const refundedTotal = transactions.filter(tx => tx.type === 'refund').reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const outstanding   = Math.max(0, escrowTotal - releasedTotal - refundedTotal)

  const statusLabel = isCancelled
    ? '已退款'
    : releasedTotal > 0
      ? '已撥款'
      : outstanding > 0
        ? '平台代管中'
        : null
  const memberRows = buildMemberRows(transactions, isCancelled)
  const memberRowsTotal = memberRows.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const showHeaderAmount = isCancelled
    ? memberRowsTotal > 0
    : statusLabel === '平台代管中' && memberRowsTotal > 0

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              {isCurrentCycle ? '本期費用' : `第 ${cycle} 期`}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {statusLabel && (
                <span className={`flex items-center gap-2 ${
                  showHeaderAmount ? `text-sm font-bold ${isCancelled ? 'text-success-text' : 'text-info'}` : 'text-xs text-ink-3'
                }`}>
                  {statusLabel}
                  {showHeaderAmount && (
                    <TokenAmount amount={memberRowsTotal} align="center" />
                  )}
                </span>
              )}
              <ChevronDown size={16} strokeWidth={1.5} className={`text-ink-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t border-line px-4 py-3">
            {!isCancelled && releasedTotal > 0 && (
              <EscrowStatusCard tone="success" icon={ArrowUpCircle} title="已撥款給你的代管總額" amount={releasedTotal} />
            )}
            <div className="overflow-hidden rounded-lg border border-line">
              {memberRows.length === 0 ? (
                <p className="px-4 py-3 text-center text-sm text-ink-3">目前尚無代管紀錄</p>
              ) : memberRows.map((tx, i) => (
                <div key={tx.userId} className={`flex items-center gap-3 py-3 pl-4 ${showHeaderAmount ? 'pr-[1.375rem]' : 'pr-4'} ${i > 0 ? 'border-t border-line-subtle' : ''}`}>
                  <span className="relative inline-block shrink-0">
                    <Avatar initial={tx.user?.avatarInitial} color={tx.user?.avatarColor} size="sm" />
                    <PresenceDot status={tx.user?.presenceStatus} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{tx.user?.name ?? '成員'}</p>
                    <p className="text-xs text-ink-3">{formatDateTime(tx.createdAt)}{isCancelled ? ' 已退回' : ''}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${isCancelled ? 'text-success-text' : 'text-info'}`}>
                    <TokenAmount amount={Math.abs(tx.amount)} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
