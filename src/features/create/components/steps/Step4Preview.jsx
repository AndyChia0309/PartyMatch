import { Link } from 'react-router-dom'
import { CalendarDays, ListChecks, Package, ShieldCheck, User, Users, Wallet } from 'lucide-react'
import { getServiceById } from '../../../../common/utils/serviceUtils'
import { toISODate } from '../../../../common/utils/date'
import { useAuthStore } from '../../../../common/stores/useAuthStore'
import CreditScoreValue from '../../../../components/ui/CreditScoreValue'
import TokenAmount from '../../../../components/ui/TokenAmount'
import LivePreviewPanel from '../LivePreviewPanel'
import { calcDisplayPrice } from '../../../../common/utils/pricingUtils'


function InfoField({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} strokeWidth={1.5} className="text-ink-4" />
        <span className="text-sm font-semibold text-ink-2">{label}</span>
      </div>
      <p className="pl-6 text-sm text-ink-3">{value}</p>
    </div>
  )
}

export default function Step4Preview({ form, agreedToTerms, onAgreedToTermsChange }) {
  const service = getServiceById(form.serviceId)
  const user = useAuthStore(s => s.user)
  const activeUser = user ? useAuthStore.getState().getProfile() : null
  const today = toISODate().replace(/-/g, '/')

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:items-stretch lg:gap-6">
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
        <div className="flex min-h-0 flex-1 flex-col bg-surface border border-line rounded-2xl p-4">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 lg:space-y-0">
              <InfoField icon={User}    label="團主"     value={activeUser?.displayName ?? '使用者'} />
              <InfoField icon={Package} label="服務／方案" value={`${service?.name ?? ''} · ${form.planName}`} />
              <InfoField icon={Wallet}  label="每位價格" value={
                <TokenAmount
                  amount={calcDisplayPrice(form.pricePerSeat, form.billingCycle)}
                  cycle={form.billingCycle}
                />
              } />
              <InfoField icon={Users}       label="開放名額" value={`${form.recruitHeadcount - 1} 人`} />
              <InfoField icon={ShieldCheck} label="信用分數" value={<CreditScoreValue score={form.minCreditScore} />} />
              <InfoField icon={CalendarDays} label="建立日期" value={today} />

              <div className="lg:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks strokeWidth={1.5} size={15} className="text-ink-4" />
                  <span className="text-sm font-semibold text-ink-2">群組規則</span>
                </div>
                {form.rules.some(r => r.trim()) ? (
                  <ul className="space-y-1.5 pl-6">
                    {form.rules.filter(r => r.trim()).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-3">
                        <span className="text-ink-4 shrink-0">{i + 1}.</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pl-6 text-sm text-ink-3">無</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <label className="flex w-full cursor-pointer items-start gap-3 px-1">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={e => onAgreedToTermsChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          />
          <span className="text-xs leading-relaxed text-ink-2">
            我已閱讀並同意 PartyMatch 的{' '}
            <Link to="/terms" target="_blank" className="font-semibold text-brand underline-offset-2 hover:underline">服務條款</Link>
            {' '}與{' '}
            <Link to="/privacy" target="_blank" className="font-semibold text-brand underline-offset-2 hover:underline">隱私政策</Link>
            ，並確認以上群組資訊正確。
          </span>
        </label>
      </div>

      <div className="mt-4 hidden shrink-0 lg:mt-0 lg:block lg:w-72">
        <LivePreviewPanel form={form} />
      </div>
    </div>
  )
}
