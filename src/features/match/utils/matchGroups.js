import { daysUntil } from '../../../common/utils/date'
import { getServiceById } from '../../../common/utils/serviceUtils'
import { isRecruitingLike } from '../../../common/utils/groupStatus'

function calcScore(group, conditions) {
  let score = 0
  if (group.hostRating >= 90) score += 2
  else if (group.hostRating >= 70) score += 1
  if (group.openSeats >= 3) score += 1
  const daysUntilBilling = daysUntil(group.nextBillingDate)
  if (daysUntilBilling > 20) score += 1
  if (conditions.maxPrice != null && group.pricePerSeat < conditions.maxPrice * 0.75) score += 1
  return score
}

function getAgeMonths(createdAt) {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
}

export function matchGroups(groups, conditions) {
  const { services = [], selectedPlans = {}, keyword, minPrice, maxPrice, minRating, groupAge } = conditions

  const filtered = groups.filter(g => {
    if (!isRecruitingLike(g.status)) return false
    if (g.openSeats <= 0) return false
    if (services.length > 0 && !services.includes(g.serviceId)) return false
    const wantedPlan = selectedPlans[g.serviceId]
    if (wantedPlan && wantedPlan !== 'any' && g.planName !== wantedPlan) return false
    if (minPrice != null && g.pricePerSeat < minPrice) return false
    if (maxPrice != null && g.pricePerSeat > maxPrice) return false
    if (minRating && minRating > 0 && g.hostRating < minRating) return false
    if (keyword?.trim()) {
      const kw = keyword.trim().toLowerCase()
      const serviceName = getServiceById(g.serviceId)?.name ?? g.serviceName ?? ''
      if (!serviceName.toLowerCase().includes(kw) && !(g.planName ?? '').toLowerCase().includes(kw)) return false
    }

    if (groupAge && groupAge !== 'any') {
      const months = getAgeMonths(g.createdAt)
      if (groupAge === 'new' && months > 3) return false
      if (groupAge === 'established' && (months < 3 || months > 12)) return false
      if (groupAge === 'veteran' && months < 12) return false
    }

    return true
  })

  return filtered
    .map(g => ({ ...g, _score: calcScore(g, conditions) }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score: _, ...g }) => g)
}
