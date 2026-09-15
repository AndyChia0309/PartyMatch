import ServiceLogo from '../../../components/ui/ServiceLogo'
import TokenAmount from '../../../components/ui/TokenAmount'
import { calcDisplayPrice } from '../../../common/utils/pricingUtils'

export default function ServiceHeroCard({ form, service, className = '' }) {
  return (
    <div className={`flex shrink-0 items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-5 ${className}`}>
      <ServiceLogo serviceId={form.serviceId} size={56} className="shrink-0 border-line-strong" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-black text-ink">{service?.name ?? '尚未選擇服務'}</h2>
        <p className="truncate text-sm text-ink-3">{form.planName || '尚未選擇方案'}</p>
      </div>
      {form.planName && (
        <div className="shrink-0 text-right">
          <p className="mb-0.5 text-xs font-medium text-ink-4">每位</p>
          <TokenAmount
            amount={calcDisplayPrice(form.pricePerSeat, form.billingCycle)}
            cycle={form.billingCycle}
            align="center"
            badgeSize="!h-6 !w-6"
            unitClassName="!text-xl"
            className="text-2xl font-black text-ink"
          />
        </div>
      )}
    </div>
  )
}
