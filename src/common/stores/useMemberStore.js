import { create } from 'zustand'
import {
  readAllMembers,
  patchMember,
  deleteMemberRecord,
  notifyExtractionStart,
} from '../api/membersApi'
import { normalizeMember } from '../utils/modelNormalizers'
import { notifyError } from '../utils/toast'
import { useGroupStore } from './useGroupStore';

export const useMemberStore = create((set, get) => ({
  members: [],
  loading: false,
  error:   null,

  init: async () => {
    set({ loading: true, error: null })
    try {
      const members = await readAllMembers()
      set({ members: members.map(normalizeMember), loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  getByGroupId: (groupId) => get().members.filter(m => m.groupId === groupId),

  getGroupIds: (userId) => {
    if (!userId) return new Set()
    return new Set(get().members.filter(m => m.userId === userId).map(m => m.groupId))
  },

  isMember: (userId, groupId) =>
    get().members.some(m => m.userId === userId && m.groupId === groupId),

  getByUserAndGroup: (userId, groupId) =>
    get().members.find(m => m.userId === userId && m.groupId === groupId) ?? null,

  update: (memberId, patch) => {
    const prior = get().members.find(m => m.id === memberId) ?? null
    set(s => ({
      members: s.members.map(m => m.id === memberId ? { ...m, ...patch } : m),
    }))
    return patchMember(memberId, patch).then(updated => {
      set(s => ({ members: s.members.map(m => m.id === memberId ? { ...m, ...updated } : m) }));
    }).catch(err => {
      if (prior)
        set(s => ({ members: s.members.map(m => m.id === memberId ? prior : m) }));
      notifyError(err, '更新失敗，請稍後再試')
    });
  },

  fillServiceInfo: async (memberId, groupId, serviceInfo) => {
    const prior = get().members.find(m => m.id === memberId) ?? null
    const clearedIssuePatch = {
      serviceInfo,
      serviceInfoIssueNote: null,
      serviceInfoIssueEvidenceUrl: null,
      serviceInfoIssueDeadline: null,
      hasServiceInfoIssue: false,
    }
    set(s => ({
      members: s.members.map(m => m.id === memberId
        ? { ...m, ...clearedIssuePatch }
        : m),
    }));
    try {
      const res = await patchMember(memberId, { serviceInfo, serviceInfoIssueNote: null, serviceInfoIssueEvidenceUrl: null, serviceInfoIssueDeadline: null })
      const { _groupAdvanced, ...updatedMember } = res ?? {}
      set(s => ({
        members: s.members.map(m => m.id === memberId
          ? { ...m, ...normalizeMember(updatedMember), hasServiceInfoIssue: false }
          : m),
      }))
      if (_groupAdvanced) {
        useGroupStore.getState().setGroupStatus(groupId, _groupAdvanced);
      }
    } catch (err) {
      set(s => ({
        members: s.members.map(m => m.id === memberId
          ? (prior ? { ...m, ...prior } : m)
          : m),
      }));
      throw err
    }
  },

  notifyExtractionStart: (memberId) => {
    notifyExtractionStart(memberId).catch(() => {})
  },

  markConfirmed: (memberId) => {
    set(s => ({
      members: s.members.map(m => m.id === memberId ? { ...m, confirmedAt: new Date().toISOString() } : m),
    }))
  },

  remove: (memberId) => {
    const prior = get().members.find(m => m.id === memberId) ?? null
    set(s => ({ members: s.members.filter(m => m.id !== memberId) }))
    return deleteMemberRecord(memberId).catch(err => {
      if (prior) set(s => ({ members: [...s.members, prior] }))
      notifyError(err, '移除成員失敗，請稍後再試')
      throw err
    })
  },

}))
