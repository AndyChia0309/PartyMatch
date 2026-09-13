import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/common/api/notificationsApi', () => ({
  readAllNotifications: vi.fn(),
  patchNotification:    vi.fn(),
}))
vi.mock('../src/common/utils/toast', () => ({
  notifyError: vi.fn(),
  dismissToast: vi.fn(),
}))

const { readAllNotifications, patchNotification } = await import('../src/common/api/notificationsApi')
const { notifyError } = await import('../src/common/utils/toast')
const { useNotificationStore, isSystemNotification } = await import('../src/common/stores/useNotificationStore')

const USER_ID = 'u1'

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], loading: false, error: null })
    vi.clearAllMocks()
  })

  it('init() 成功時去重（同 id 只留第一筆）', async () => {
    readAllNotifications.mockResolvedValue([
      { id: 'n1', userId: USER_ID },
      {
        id: 'n1',
        userId: USER_ID
      },
      { id: 'n2', userId: USER_ID },
    ])
    await useNotificationStore.getState().init()
    expect(useNotificationStore.getState().notifications).toHaveLength(2)
  })

  it('getByUserId／getUnreadCount', () => {
    useNotificationStore.setState({
      notifications: [
        { id: 'n1', userId: USER_ID, isRead: false, createdAt: '2026-01-02' },
        { id: 'n2', userId: USER_ID, isRead: true, createdAt: '2026-01-01' },
        { id: 'n3', userId: 'other', isRead: false, createdAt: '2026-01-01' },
      ],
    })
    expect(useNotificationStore.getState().getByUserId(USER_ID)).toHaveLength(2)
    expect(useNotificationStore.getState().getUnreadCount(USER_ID)).toBe(1)
    expect(useNotificationStore.getState().getUnreadCount(null)).toBe(0)
  })

  it('getSystemNotifications：沒有真實系統通知時回傳內建的訪客歡迎訊息', () => {
    expect(useNotificationStore.getState().getSystemNotifications()).toHaveLength(1)
    expect(useNotificationStore.getState().getSystemNotifications()[0].id).toBe('system_guest_welcome')
  })

  it('getSystemNotifications：有真實系統/公開通知時優先顯示，不用 fallback', () => {
    useNotificationStore.setState({
      notifications: [{ id: 'n1', type: 'system', isPublic: true, createdAt: '2026-01-01' }],
    })
    const result = useNotificationStore.getState().getSystemNotifications()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n1')
  })

  it('isSystemNotification：type=system、isPublic、沒有 userId 都算系統通知', () => {
    expect(isSystemNotification({ type: 'system' })).toBe(true)
    expect(isSystemNotification({ type: 'other', isPublic: true })).toBe(true)
    expect(isSystemNotification({ type: 'other', userId: null })).toBe(true)
    expect(isSystemNotification({ type: 'other', userId: 'u1' })).toBe(false)
  })

  it('markRead() 樂觀標記已讀，失敗時回滾', async () => {
    useNotificationStore.setState({ notifications: [{ id: 'n1', userId: USER_ID, isRead: false }] })
    let rejectFn
    patchNotification.mockReturnValue(new Promise((_, reject) => { rejectFn = reject }))

    useNotificationStore.getState().markRead('n1')
    expect(useNotificationStore.getState().notifications[0].isRead).toBe(true)

    rejectFn(new Error('標記失敗'))
    await vi.waitFor(() => {
      expect(useNotificationStore.getState().notifications[0].isRead).toBe(false)
    })
    expect(notifyError).toHaveBeenCalled()
  })

  it('markReadForGroup() 只標記指定使用者在該群組底下的未讀通知', () => {
    useNotificationStore.setState({
      notifications: [
        { id: 'n1', userId: USER_ID, isRead: false, meta: { groupId: 'g1' } },
        { id: 'n2', userId: USER_ID, isRead: false, meta: { groupId: 'g2' } },
        { id: 'n3', userId: 'other', isRead: false, meta: { groupId: 'g1' } },
      ],
    })
    patchNotification.mockResolvedValue({})

    useNotificationStore.getState().markReadForGroup(USER_ID, 'g1')

    expect(useNotificationStore.getState().notifications.find(n => n.id === 'n1').isRead).toBe(true)
    expect(useNotificationStore.getState().notifications.find(n => n.id === 'n2').isRead).toBe(false)
    expect(useNotificationStore.getState().notifications.find(n => n.id === 'n3').isRead).toBe(false)
  })

  it('startPolling()：超過 10 分鐘的舊通知不跳 Toast，但仍會靜默更新資料/加入清單', async () => {
    const now = Date.now()
    const staleNotifyToast = { id: 'n1', userId: USER_ID, type: 'group_created', createdAt: new Date(now - 11 * 60 * 1000).toISOString() }
    const freshNotifyToast = { id: 'n2', userId: USER_ID, type: 'group_created', createdAt: new Date(now).toISOString() }
    const staleRefreshStore = { id: 'n3', userId: USER_ID, type: 'application_rejected', createdAt: new Date(now - 11 * 60 * 1000).toISOString() }
    readAllNotifications.mockResolvedValue([staleNotifyToast, freshNotifyToast, staleRefreshStore])

    const notifyToastSpy = vi.fn()
    const refreshStoresSpy = vi.fn()
    window.addEventListener('pm:notify-toast', notifyToastSpy)
    window.addEventListener('pm:refresh-stores', refreshStoresSpy)

    useNotificationStore.getState().startPolling(USER_ID)
    await vi.waitFor(() => {
      expect(useNotificationStore.getState().notifications).toHaveLength(3)
    })

    expect(notifyToastSpy).toHaveBeenCalledTimes(1)
    expect(notifyToastSpy.mock.calls[0][0].detail.type).toBe('group_created')

    expect(refreshStoresSpy).toHaveBeenCalledTimes(1)
    expect(refreshStoresSpy.mock.calls[0][0].detail.silent).toBe(true)

    window.removeEventListener('pm:notify-toast', notifyToastSpy)
    window.removeEventListener('pm:refresh-stores', refreshStoresSpy)
    useNotificationStore.getState().teardown()
  })
})
