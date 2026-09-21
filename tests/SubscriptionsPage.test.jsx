import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubscriptionsPage from '../src/features/subscriptions/SubscriptionsPage'
import { useSubscriptionStore } from '../src/common/stores/useSubscriptionStore'
import { useGroupStore } from '../src/common/stores/useGroupStore'
import { useApplicationStore } from '../src/common/stores/useApplicationStore'
import { useMemberStore } from '../src/common/stores/useMemberStore'
import { useAuthStore } from '../src/common/stores/useAuthStore'

function renderSubscriptionsPage() {
  return render(
    <MemoryRouter>
      <SubscriptionsPage />
    </MemoryRouter>
  )
}

const USER = { id: 'user-1' }

function group(overrides) {
  return {
    id: overrides.id, hostId: 'host-1', hostName: '團主小明', pricePerSeat: 190,
    billingCycle: 'monthly', usedSeats: 1, totalSeats: 2, createdAt: '2026-01-01',
    ...overrides,
  }
}

function sub(overrides) {
  return { id: overrides.id, userId: USER.id, groupId: overrides.groupId, createdAt: '2026-01-01', ...overrides }
}

describe('SubscriptionsPage', () => {
  beforeEach(() => {
    useSubscriptionStore.setState({ subscriptions: [] })
    useGroupStore.setState({ groups: [] })
    useApplicationStore.setState({ applications: [] })
    useMemberStore.setState({ members: [] })
    useAuthStore.setState({ user: USER, loggedIn: true })
  })

  it('沒有任何訂閱或申請時顯示「還沒有加入任何群組」', () => {
    renderSubscriptionsPage()
    expect(screen.getByText('你還沒有加入任何群組')).toBeInTheDocument()
  })

  it('groupStatus 為 recruiting 的訂閱會出現', () => {
    useGroupStore.setState({ groups: [group({ id: 'g1', serviceId: 'netflix', serviceName: 'Netflix', planName: '標準（月繳）', status: 'recruiting' })] })
    useSubscriptionStore.setState({ subscriptions: [sub({ id: 's1', groupId: 'g1' })] })

    renderSubscriptionsPage()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
  })

  it('processing／服務進行中的訂閱與還沒被審核的申請都會同時顯示在同一份列表', () => {
    useGroupStore.setState({
      groups: [
        group({ id: 'g1', serviceId: 'netflix', serviceName: 'Netflix', planName: '標準（月繳）', status: 'recruiting' }),
        group({ id: 'g2', serviceId: 'spotify', serviceName: 'Spotify', planName: 'Duo（月繳）', status: 'confirming' }),
        group(
          { id: 'g3', serviceId: 'disney', serviceName: 'Disney+', planName: '標準（月繳）', status: 'recruiting' }
        ),
      ],
    })
    useSubscriptionStore.setState({
      subscriptions: [
        sub({ id: 's1', groupId: 'g1' }),
        sub({ id: 's2', groupId: 'g2' }),
      ],
    })
    useApplicationStore.setState({
      applications: [{ id: 'a1', userId: USER.id, groupId: 'g3', status: 'pending', hostName: '團主阿花', createdAt: '2026-01-01' }],
    })

    renderSubscriptionsPage()

    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Spotify')).toBeInTheDocument()
    expect(screen.getByText('審核進行中')).toBeInTheDocument();
  })

  it('active 狀態、以及自己已確認的 confirming 訂閱都會顯示', () => {
    useGroupStore.setState({
      groups: [
        group({ id: 'g1', serviceId: 'netflix', serviceName: 'Netflix', planName: '標準（月繳）', status: 'active' }),
        group({ id: 'g2', serviceId: 'spotify', serviceName: 'Spotify', planName: 'Duo（月繳）', status: 'confirming' }),
      ],
    })
    useSubscriptionStore.setState({
      subscriptions: [
        sub({ id: 's1', groupId: 'g1' }),
        sub({ id: 's2', groupId: 'g2' }),
      ],
    })
    useMemberStore.setState({
      members: [{ id: 'm1', userId: USER.id, groupId: 'g2', confirmedAt: '2026-01-05' }],
    })

    renderSubscriptionsPage()

    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Spotify')).toBeInTheDocument();
  })

  it('已解散/已結束服務（history 狀態）的訂閱不會出現在列表', () => {
    useGroupStore.setState({
      groups: [
        group({ id: 'g1', serviceId: 'netflix', serviceName: 'Netflix', planName: '標準（月繳）', status: 'recruiting' }),
        group({ id: 'g2', serviceId: 'spotify', serviceName: 'Spotify', planName: 'Duo（月繳）', status: 'cancelled' }),
      ],
    })
    useSubscriptionStore.setState({
      subscriptions: [
        sub({ id: 's1', groupId: 'g1' }),
        sub({ id: 's2', groupId: 'g2' }),
      ],
    })

    renderSubscriptionsPage()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.queryByText('Spotify')).not.toBeInTheDocument()
  })
})
