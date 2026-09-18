export function resolveMonthlyPrice(plan) {
  return Number(plan?.monthlyPrice ?? plan?.monthlyFee ?? plan?.totalMonthlyFee ?? 0)
}

export function calcPricePerSeat(plan, seats) {
  return Math.ceil(resolveMonthlyPrice(plan) / seats)
}

export function calcDisplayPrice(pricePerSeat, billingCycle) {
  return billingCycle === 'yearly' ? pricePerSeat * 12 : pricePerSeat
}

export function calcDisplayCycle(billingCycle) {
  return billingCycle === 'yearly' ? 'yearly' : 'monthly'
}
