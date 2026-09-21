import { getServiceById } from './serviceUtils'
import { byNewest } from './date'
import { isRecruitingLike } from './groupStatus'

export function applyFilters(groups, { category }) {
  let result = groups.filter(g => isRecruitingLike(g.status) && g.openSeats > 0)

  if (category !== 'all') result = result.filter(g => getServiceById(g.serviceId)?.category === category)

  return result.sort(byNewest)
}
