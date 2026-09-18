import { create } from 'zustand'
import { SERVICES } from '../data/serviceCatalog'
import { readAllServices } from '../api/servicesApi'
import { resolveMonthlyPrice } from '../utils/pricingUtils'

export const useServiceStore = create((set, get) => ({
  services: [...SERVICES],
  loading:  false,
  error:    null,

  init: async () => {
    set({ loading: true, error: null })
    try {
      const data = await readAllServices()
      if (data.length > 0) {
        const localMap = Object.fromEntries(SERVICES.map(s => [s.id, s]));
        const merged = data.map(apiService => {
          const base = { ...(localMap[apiService.id] ?? {}), ...apiService }
          if (Array.isArray(base.plans)) {
            const localPlans = localMap[apiService.id]?.plans ?? []
            const localPlanMap = {}
            const normalize = name => (name ?? '').trim()
            for (const p of localPlans) {
              const key = normalize(p.name)
              if (localPlanMap[key]) {
                console.warn(`[serviceStore] "${apiService.id}" 有重複的方案名稱「${p.name}」，本地文案比對可能會對到錯的方案`)
              }
              localPlanMap[key] = p
            }
            base.plans = base.plans.map(p => {
              const localPlan = localPlanMap[normalize(p.name)]
              if (!localPlan) {
                console.warn(`[serviceStore] "${apiService.id}" 的方案「${p.name}」在本地 catalog 找不到對應項目，將不會有 description/features 文案`)
              }
              const mergedPlan = { ...(localPlan ?? {}), ...p }
              return {
                ...mergedPlan,
                maxSeats:     mergedPlan.maxSeats ?? mergedPlan.maxMembers ?? 0,
                monthlyPrice: resolveMonthlyPrice(mergedPlan),
              }
            })
          }
          return base
        })
        set({ services: merged.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)), loading: false })
      } else {
        set({ loading: false })
      }
    } catch (err) {
      console.warn('[serviceStore] API unavailable, using local catalog:', err.message)
      set({ loading: false })
    }
  },

  getById:       (id)       => get().services.find(s => s.id === id) ?? null,
  getByCategory: (category) => get().services.filter(s => s.category === category),
}))
