import { create } from 'zustand'
import {
  readAllGroups,
  insertGroup,
  fetchGroupById,
  patchGroup,
  lockGroupApi,
  activateGroupApi,
  confirmGroupApi,
  cancelGroupApi,
  reportServiceInfoIssueApi,
  withdrawServiceInfoIssueApi,
  disputeGroupApi,
  withdrawDisputeApi,
  resolveDisputeApi,
  escalateDisputeApi,
  renewGroupApi,
  adjustBillingDateApi,
} from '../api/groupsApi'
import { normalizeGroup } from '../utils/modelNormalizers'
import { createId } from '../utils/storage'
import { nowISO, byNewest } from '../utils/date'
import { notifyError } from '../utils/toast'

function mergeGroupUpdate(groups, id, updated) {
  const exists = groups.some(g => g.id === id)
  if (!exists) return [...groups, normalizeGroup(updated)]
  return groups.map(g => g.id === id ? normalizeGroup({ ...g, ...updated }) : g)
}

export const useGroupStore = create((set, get) => ({
  groups:  [],
  loading: false,
  error:   null,

  init: async ({ all = false } = {}) => {
    set({ loading: true, error: null })
    try {
      const groups = await readAllGroups(all ? { status: 'all' } : { status: 'recruiting' })
      set({ groups: groups.map(normalizeGroup), loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  refreshGroup: async (id) => {
    const updated = await fetchGroupById(id)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    return updated
  },

  removeFromList: (id) => {
    set(s => ({ groups: s.groups.filter(g => g.id !== id) }))
  },

  getById: (id)     => get().groups.find(g => g.id === id) ?? null,
  getByHostId:  (hostId) => get().groups
    .filter(g => g.hostId === hostId)
    .sort(byNewest),
  getRecruiting: ()      => get().groups.filter(g => g.status === 'recruiting'),

  create: (data, host, { onSaved, onError } = {}) => {
    if (!host) throw new Error('登入後才能建立群組')
    const now = nowISO()
    const group = normalizeGroup({
      id:                createId(`group_${data.serviceId}`),
      hostId:            host.id,
      hostName:          host.displayName,
      hostRating:        host.creditScore,
      hostReviewCount:   0,
      hostAvatarInitial: host.avatarInitial,
      hostAvatarColor:   host.avatarColor,
      status:            'recruiting',
      createdAt:         now,
      updatedAt:         now,
      usedSeats:         1,
      openSeats:         (data.totalSeats ?? 6) - 1,
      tags:              [],
      rules:             [],
      reviews:           [],
      description:       '',
      ...data,
    })
    set(s => ({ groups: [...s.groups, group] }))
    insertGroup(group).then(saved => {
      if (saved?.id) {
        const normalized = normalizeGroup({ ...saved })
        set(s => ({ groups: s.groups.map(g => g.id === group.id ? normalized : g) }))
        onSaved?.(saved)
      }
    }).catch(err => {
      set(s => ({ groups: s.groups.filter(g => g.id !== group.id), error: err.message }));
      const handled = onError?.(err)
      if (!handled) notifyError(err, '群組建立失敗，請稍後再試')
    })
    return group
  },

  update: (id, patch) => {
    const prior = get().groups.find(g => g.id === id) ?? null
    let updated = null
    set(s => ({
      groups: s.groups.map(g => {
        if (g.id !== id) return g
        updated = normalizeGroup({ ...g, ...patch })
        return updated
      }),
    }))
    patchGroup(id, patch).catch(err => {
      if (prior)
        set(s => ({ groups: s.groups.map(g => g.id === id ? prior : g) }));
      notifyError(err, '群組更新失敗，請稍後再試')
    })
    return updated
  },

  lockGroup: async (id, sharedCredentials) => {
    const updated = await lockGroupApi(id, sharedCredentials)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    return updated
  },

  activateService: async (id, nextBillingDate) => {
    const updated = await activateGroupApi(id, nextBillingDate)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    return updated
  },

  confirmService: async (id) => {
    const res = await confirmGroupApi(id)
    if (res.released && res.group) {
      set(s => ({ groups: mergeGroupUpdate(s.groups, id, res.group) }))
    }
    return res
  },

  adjustBillingDate: async (id, payload) => {
    const updated = await adjustBillingDateApi(id, payload)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    return updated
  },

  reportServiceInfoIssue: async (id, payload) => {
    const updated = await reportServiceInfoIssueApi(id, payload)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    const { useMemberStore } = await import('./useMemberStore');
    useMemberStore.getState().init().catch(console.error)
    return updated
  },

  withdrawServiceInfoIssue: async (id, memberId) => {
    const updated = await withdrawServiceInfoIssueApi(id, memberId)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    const { useMemberStore } = await import('./useMemberStore');
    useMemberStore.getState().init().catch(console.error)
    return updated
  },

  disputeGroup: async (id, payload) => {
    const updated = await disputeGroupApi(id, payload)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    const { useMemberStore } = await import('./useMemberStore');
    useMemberStore.getState().init().catch(console.error)
    return updated
  },

  withdrawDispute: async (id) => {
    const updated = await withdrawDisputeApi(id)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    const { useMemberStore } = await import('./useMemberStore');
    useMemberStore.getState().init().catch(console.error)
    return updated
  },

  resolveDispute: async (id, payload) => {
    const updated = await resolveDisputeApi(id, payload)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    const { useMemberStore } = await import('./useMemberStore');
    useMemberStore.getState().init().catch(console.error)
    return updated
  },

  escalateDispute: async (id, payload) => {
    const updated = await escalateDisputeApi(id, payload)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    return updated
  },

  cancelGroup: async (id) => {
    await cancelGroupApi(id)
    set(s => ({
      groups: s.groups.map(g => g.id === id ? { ...g, status: 'cancelled', escrowTokens: 0 } : g),
    }))
  },

  setGroupStatus: (id, status) => {
    set(s => ({
      groups: s.groups.map(g => g.id === id ? { ...g, status } : g),
    }))
  },

  startRenewalCycle: async (id, renewingUserIds) => {
    const updated = await renewGroupApi(id, renewingUserIds)
    set(s => ({ groups: mergeGroupUpdate(s.groups, id, updated) }))
    return updated
  },

  endGroup: (id) => get().update(id, { status: 'ended' }),
}))
