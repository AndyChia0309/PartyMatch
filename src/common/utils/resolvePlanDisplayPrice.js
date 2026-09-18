import { resolveMonthlyPrice } from './pricingUtils'

export function resolvePlanDisplayPrice(plan, usdToTwdRate) {
  const monthlyPrice = resolveMonthlyPrice(plan)
  if (plan.billingCycle !== 'yearly') {
    return { amount: monthlyPrice, cycle: 'monthly' }
  }
  if (plan.yearlyPrice) return { amount: plan.yearlyPrice, cycle: 'yearly' }
  if (plan.yearlyPriceUsd) return { amount: Math.round(plan.yearlyPriceUsd * usdToTwdRate), cycle: 'yearly' }
  return { amount: monthlyPrice * 12, cycle: 'yearly' }
}
