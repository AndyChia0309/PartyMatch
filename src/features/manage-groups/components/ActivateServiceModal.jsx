import { useEffect, useState } from 'react'
import { Calendar, ChevronDown, PlayCircle, UserCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogCloseButton } from '../../../components/ui/dialog'
import { AvatarWithPresence } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import ServiceLogo from '../../../components/ui/ServiceLogo'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../../components/ui/collapsible'
import TokenAmount from '../../../components/ui/TokenAmount'
import GroupOverviewContent from '../../../components/ui/group/GroupOverviewContent'
import { Input } from '../../../components/ui/input'
import { toISODate } from '../../../common/utils/date'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { hasFilledServiceInfo, getServiceInfoSummary, isSharedCredentialsMethod } from '../../../common/utils/serviceInfoFields'
import { fetchGroupTransactions } from '../../../common/api/groupsApi'
import { buildMemberRows } from '../../../common/utils/billingRows'

function getActivationDateRange(baseline, billingCycle) {
  const min = new Date(baseline)
  min.setUTCHours(0, 0, 0, 0)
  if (billingCycle === 'yearly') min.setFullYear(min.getFullYear() + 1)
  else min.setMonth(min.getMonth() + 1)
  const max = new Date(min)
  max.setDate(max.getDate() + 30)
  return { min, max }
}

export default function ActivateServiceModal({
  isOpen,
  onClose,
  onConfirm,
  group,
  members,
  memberChecks,
  setMemberChecks,
  allMembersChecked,
  isFirstActivation = false,
  billingDate = '',
  setBillingDate,
  loading = false,
}) {
  const baseline = isFirstActivation ? new Date() : group.nextBillingDate
  const { min: minBillingDate, max: maxBillingDate } = getActivationDateRange(baseline, group.billingCycle)
  const minBillingDateStr = toISODate(minBillingDate)
  const maxBillingDateStr = toISODate(maxBillingDate)
  const service  = getServiceById(group.serviceId)
  const plan     = service?.plans.find(p => p.name === group.planName)
  const sharingMethod = service?.sharingMethod

  const [escrowOpen, setEscrowOpen] = useState(true)
  const [escrowTransactions, setEscrowTransactions] = useState([])
  const [escrowTransactionsLoading, setEscrowTransactionsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEscrowTransactionsLoading(true)
    fetchGroupTransactions(group.id)
      .then(data => { if (active) setEscrowTransactions(data) })
      .catch(() => { if (active) setEscrowTransactions([]) })
      .finally(() => { if (active) setEscrowTransactionsLoading(false) })
    return () => { active = false }
  }, [isOpen, group.id])

  const cycleTransactions = escrowTransactions.filter(tx => (tx.cycle ?? 1) === (group.currentCycle ?? 1))
  const escrowMemberRows  = buildMemberRows(cycleTransactions, false)

  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent variant="panel" maxWidth="max-w-lg" height="36rem" instant>
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2.5">
            <PlayCircle strokeWidth={1.5} size={18} className="shrink-0 text-brand" />
            <DialogTitle className="truncate text-base">啟用服務</DialogTitle>
          </div>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>啟用服務</DialogDescription>
        <DialogBody>
      <div className="animate-step-slide-up flex-1 min-h-0 overflow-y-auto">

        <div className="flex items-center gap-3 border-b border-line-subtle px-5 py-4">
          <ServiceLogo serviceId={group.serviceId} size={40} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{group.serviceName}</p>
            <p className="text-xs text-ink-3">{group.planName}</p>
          </div>
        </div>

        <div className="px-5 pt-5">
          <GroupOverviewContent
            group={{ ...group, nextBillingDate: null }}
            service={service}
            plan={plan}
            extraRows={isFirstActivation ? [] : [{ label: '上一期扣款日', value: toISODate(group.nextBillingDate, '—') }]}
            reviewsSection={
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-lg font-black text-brand"><UserCheck strokeWidth={1.5} size={16} />確認成員已啟用外部服務</p>
                  <p className="text-xs text-ink-3">
                    {members.filter(m => memberChecks[m.id] && !m.serviceInfoIssueNote).length} / {members.length} 已確認
                  </p>
                </div>
                <p className="text-sm text-ink-2">請在外部平台（{group.serviceName}）確認每位成員的帳號已完成設定，再逐一勾選。</p>

                <div className="overflow-hidden rounded-lg border border-line">
                  <Collapsible open={escrowOpen} onOpenChange={setEscrowOpen}>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
                        <span className="text-sm font-bold text-ink">本期費用</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="flex items-center gap-2 text-sm font-bold text-info">
                            平台代管中
                            <TokenAmount amount={group.escrowTokens} align="center" />
                          </span>
                          <ChevronDown size={16} strokeWidth={1.5} className={`text-ink-4 transition-transform ${escrowOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 border-t border-line px-4 py-3">
                        {members.length === 0 ? (
                          <p className="py-2 text-center text-sm text-ink-3">尚無成員</p>
                        ) : members.map(m => {
                          const escrowTx = escrowMemberRows.find(tx => tx.userId === m.userId)
                          return (
                            <div
                              key={m.id}
                              className={`rounded-lg border p-3 transition-colors ${
                                m.serviceInfoIssueNote ? 'border-warning/40 bg-warning-subtle' :
                                memberChecks[m.id] ? 'border-brand/40 bg-brand-subtle' :
                                'border-line'
                              }`}
                            >
                              <label className="flex cursor-pointer items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={!!memberChecks[m.id]}
                                  onChange={e => {
                                    const checked = e.target.checked
                                    setMemberChecks(prev => ({ ...prev, [m.id]: checked }))
                                  }}
                                  className="h-4 w-4 shrink-0 accent-brand"
                                />
                                <AvatarWithPresence initial={m.userAvatarInitial} color={m.userAvatarColor} size="sm" presenceStatus={m.userPresenceStatus} dotClassName="h-2.5 w-2.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-ink">{m.userName}</p>
                                  {m.serviceInfoIssueNote ? (
                                    <p className="text-xs text-warning-text">回報問題中，等待修正</p>
                                  ) : hasFilledServiceInfo(m.serviceInfo, sharingMethod, service?.id) ? (
                                    <p className="text-xs text-ink-3">{getServiceInfoSummary(m.serviceInfo, sharingMethod, service?.id)}</p>
                                  ) : (
                                    <p className="text-xs text-ink-4">{isSharedCredentialsMethod(sharingMethod) ? '尚未提取帳號資訊' : '尚未填寫帳號'}</p>
                                  )}
                                </div>
                                <span className="shrink-0 text-sm font-bold text-info">
                                  {escrowTransactionsLoading ? '…' : escrowTx ? <TokenAmount amount={Math.abs(escrowTx.amount)} /> : '—'}
                                </span>
                              </label>
                            </div>
                          )
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            }
          />
          <div className="space-y-4 border-t border-line-subtle py-5">
            <p className="flex items-center gap-2 text-lg font-black text-brand"><Calendar strokeWidth={1.5} size={16} />設定扣款日期</p>
            <span className="relative block">
              <Input
                type="date"
                min={minBillingDateStr}
                max={maxBillingDateStr}
                value={billingDate}
                onChange={e => setBillingDate?.(e.target.value)}
                placeholder="請選擇扣款日期"
              />
              {!billingDate && (
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-ink-4 can-hover:hidden">
                  請選擇扣款日期
                </span>
              )}
            </span>
            <p className="text-xs text-ink-3">
              {isFirstActivation
                ? `請依外部平台實際啟用/扣款日期填寫，最早為 ${minBillingDateStr}，最晚為 ${maxBillingDateStr}。`
                : `請依外部平台實際扣款日期填寫，最早為 ${minBillingDateStr}，最晚為 ${maxBillingDateStr}。`}
              此日期由團主自行認定，成員如對日期有疑義可聯繫客服反映。
            </p>
          </div>
        </div>
      </div>
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={onConfirm}
            disabled={!allMembersChecked || !billingDate}
            loading={loading}
            className="flex-1 rounded-lg"
          >確認啟用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
