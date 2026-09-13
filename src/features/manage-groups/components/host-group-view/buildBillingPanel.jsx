import { Banknote } from 'lucide-react'
import EmptyState from '../../../../components/ui/primitives/EmptyState'
import BillingCycleSection from './BillingCycleSection'
import InsufficientBalanceNotice from './InsufficientBalanceNotice'

export function buildBillingPanel({ groupMembers, transactions, transactionsLoading, showRenewal, currentCycle, isCancelled, pendingApplicantUserIds }) {
  const insufficientMembers = (groupMembers ?? []).filter(m => m.hasSufficientBalanceForRenewal === false)
  const cycleGroups = new Map()
  for (const tx of transactions) {
    const cycle = tx.cycle ?? 1
    if (!cycleGroups.has(cycle)) cycleGroups.set(cycle, [])
    cycleGroups.get(cycle).push(tx)
  }
  const cycles = [...cycleGroups.keys()].sort((a, b) => b - a);

  return {
    content: (
      <div className="relative min-h-full p-5">
        {showRenewal && insufficientMembers.length > 0 && (
          <div className="mb-3">
            <InsufficientBalanceNotice members={insufficientMembers} />
          </div>
        )}
        {transactionsLoading ? (
          <p className="py-8 text-center text-sm text-ink-3">載入中…</p>
        ) : cycles.length === 0 ? (
          <EmptyState icon={Banknote} title="目前尚無代管紀錄" />
        ) : (
          <div className="space-y-3">
            {cycles.map(cycle => (
              <BillingCycleSection
                key={cycle}
                cycle={cycle}
                isCurrentCycle={cycle === currentCycle}
                transactions={cycleGroups.get(cycle)}
                isCancelled={isCancelled}
                pendingApplicantUserIds={pendingApplicantUserIds}
                defaultOpen={cycle === cycles[0]}
              />
            ))}
          </div>
        )}
      </div>
    ),
  };
}
