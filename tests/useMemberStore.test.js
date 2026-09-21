import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/common/api/membersApi', () => ({
  readAllMembers:     vi.fn(),
  patchMember:        vi.fn(),
  deleteMemberRecord: vi.fn(),
}))
vi.mock('../src/common/utils/toast', () => ({
  notifyError: vi.fn(),
}))
const setGroupStatusMock = vi.fn();
vi.mock('../src/common/stores/useGroupStore', () => ({
  useGroupStore: { getState: () => ({ setGroupStatus: setGroupStatusMock }) },
}))

const { readAllMembers, patchMember, deleteMemberRecord } = await import('../src/common/api/membersApi')
const { notifyError } = await import('../src/common/utils/toast')
const { useMemberStore } = await import('../src/common/stores/useMemberStore')

const MEMBER = { id: 'm1', groupId: 'g1', userId: 'u1', serviceInfo: null, serviceInfoIssueNote: null }

describe('useMemberStore', () => {
  beforeEach(() => {
    useMemberStore.setState({ members: [], loading: false, error: null })
    vi.clearAllMocks()
  })

  it('init() 成功時把成員放進 state', async () => {
    readAllMembers.mockResolvedValue([MEMBER])
    await useMemberStore.getState().init()
    expect(useMemberStore.getState().members).toHaveLength(1)
  })

  it('選取器：getByGroupId／getGroupIds／isMember／getByUserAndGroup', () => {
    useMemberStore.setState({ members: [MEMBER] })
    expect(useMemberStore.getState().getByGroupId('g1')).toHaveLength(1)
    expect(useMemberStore.getState().getGroupIds('u1').has('g1')).toBe(true)
    expect(useMemberStore.getState().getGroupIds(null).size).toBe(0)
    expect(useMemberStore.getState().isMember('u1', 'g1')).toBe(true)
    expect(useMemberStore.getState().isMember('u2', 'g1')).toBe(false)
    expect(useMemberStore.getState().getByUserAndGroup('u1', 'g1')?.id).toBe('m1')
  })

  it('update() 樂觀更新，失敗時回滾並跳錯誤提示', async () => {
    useMemberStore.setState({ members: [MEMBER] })
    let rejectFn
    patchMember.mockReturnValue(new Promise((_, reject) => { rejectFn = reject }))

    useMemberStore.getState().update('m1', { serviceInfoIssueNote: '帳密錯誤' })
    expect(useMemberStore.getState().getByUserAndGroup('u1', 'g1').serviceInfoIssueNote).toBe('帳密錯誤')

    rejectFn(new Error('網路錯誤'))
    await vi.waitFor(() => {
      expect(useMemberStore.getState().getByUserAndGroup('u1', 'g1').serviceInfoIssueNote).toBeNull()
    })
    expect(notifyError).toHaveBeenCalled()
  })

  it('fillServiceInfo() 成功且全員填完時，通知 useGroupStore 推進狀態', async () => {
    useMemberStore.setState({ members: [MEMBER] })
    patchMember.mockResolvedValue({ ...MEMBER, serviceInfo: { account: 'a@b.com' }, _groupAdvanced: 'pending_activation' })

    await useMemberStore.getState().fillServiceInfo('m1', 'g1', { account: 'a@b.com' })
    expect(useMemberStore.getState().getByUserAndGroup('u1', 'g1').serviceInfo).toEqual({ account: 'a@b.com' })
    expect(setGroupStatusMock).toHaveBeenCalledWith('g1', 'pending_activation')
  })

  it('fillServiceInfo() 失敗時回滾成原本的值並往外拋錯誤', async () => {
    useMemberStore.setState({ members: [{ ...MEMBER, serviceInfo: { account: 'old@b.com' } }] })
    patchMember.mockRejectedValue(new Error('填寫失敗'))

    await expect(useMemberStore.getState().fillServiceInfo('m1', 'g1', { account: 'new@b.com' }))
      .rejects.toThrow('填寫失敗')
    expect(useMemberStore.getState().getByUserAndGroup('u1', 'g1').serviceInfo).toEqual({ account: 'old@b.com' })
  })

  it('remove() 樂觀移除，失敗時把成員加回來', async () => {
    useMemberStore.setState({ members: [MEMBER] })
    deleteMemberRecord.mockRejectedValue(new Error('移除失敗'))

    await expect(useMemberStore.getState().remove('m1')).rejects.toThrow('移除失敗')
    expect(useMemberStore.getState().members).toHaveLength(1)
    expect(notifyError).toHaveBeenCalled()
  })
})
