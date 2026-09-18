import { describe, it, expect } from 'vitest'
import { calcPricePerSeat, calcDisplayPrice, calcDisplayCycle, resolveMonthlyPrice } from '../src/common/utils/pricingUtils'

describe('resolveMonthlyPrice', () => {
  it('支援前端 catalog 與後端 API 的金額欄位別名', () => {
    expect(resolveMonthlyPrice({ monthlyPrice: 300 })).toBe(300)
    expect(resolveMonthlyPrice({ monthlyFee: 300 })).toBe(300)
    expect(resolveMonthlyPrice({ totalMonthlyFee: 300 })).toBe(300)
  })
})

describe('calcPricePerSeat', () => {
  it('無條件進位分攤到每個席位', () => {
    expect(calcPricePerSeat({ monthlyPrice: 300 }, 2)).toBe(150)
    expect(calcPricePerSeat({ monthlyPrice: 100 }, 3)).toBe(34);
  })

  it('可用 production API 回傳的 monthlyFee 分攤席位', () => {
    expect(calcPricePerSeat({ monthlyFee: 380 }, 2)).toBe(190)
  })
})

describe('calcDisplayPrice', () => {
  it('年繳顯示整年總額（月費 × 12）', () => {
    expect(calcDisplayPrice(100, 'yearly')).toBe(1200)
  })

  it('月繳顯示單月金額，維持原樣', () => {
    expect(calcDisplayPrice(100, 'monthly')).toBe(100)
  })

  it('billingCycle 為 undefined/其他值時視為月繳', () => {
    expect(calcDisplayPrice(100, undefined)).toBe(100)
    expect(calcDisplayPrice(100, 'weekly')).toBe(100)
  })
})

describe('calcDisplayCycle', () => {
  it('只有 yearly 會被正規化成 yearly，其餘一律視為 monthly', () => {
    expect(calcDisplayCycle('yearly')).toBe('yearly')
    expect(calcDisplayCycle('monthly')).toBe('monthly')
    expect(calcDisplayCycle(undefined)).toBe('monthly')
    expect(calcDisplayCycle(null)).toBe('monthly')
  })
})
