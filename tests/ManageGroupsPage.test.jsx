import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ManageGroupsPage from '../src/features/manage-groups/ManageGroupsPage'
import { useGroupStore } from '../src/common/stores/useGroupStore'
import { useAuthStore } from '../src/common/stores/useAuthStore'
import { useApplicationStore } from '../src/common/stores/useApplicationStore'
import { useMemberStore } from '../src/common/stores/useMemberStore'

function renderManageGroupsPage() {
  return render(
    <MemoryRouter>
      <ManageGroupsPage />
    </MemoryRouter>
  )
}

const HOST = { id: 'host-1' }

function hostedGroup(overrides) {
  return {
    hostId: HOST.id, planName: '標準（月繳）', pricePerSeat: 190, billingCycle: 'monthly',
    maxMembers: 4, currentMembers: 1, usedSeats: 1, openSeats: 3, createdAt: '2026-01-01',
    ...overrides,
  }
}

describe('ManageGroupsPage', () => {
  beforeEach(() => {
    useGroupStore.setState({ groups: [], loading: false, error: null })
    useApplicationStore.setState({ applications: [] })
    useMemberStore.setState({ members: [] })
    useAuthStore.setState({ user: HOST, loggedIn: true })
  })

  it('團主還沒建立任何群組時顯示對應空狀態', () => {
    renderManageGroupsPage()
    expect(screen.getByText('你還沒有建立任何群組')).toBeInTheDocument()
  })

  it('招募中與處理中的群組會同時顯示在同一份列表', () => {
    useGroupStore.setState({
      groups: [
        hostedGroup({ id: 'g1', serviceId: 'netflix', serviceName: 'Netflix', status: 'recruiting' }),
        hostedGroup({ id: 'g2', serviceId: 'spotify', serviceName: 'Spotify', status: 'pending_confirmation' }),
      ],
    })
    renderManageGroupsPage()

    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Spotify')).toBeInTheDocument()
  })

  it('已解散/已結束服務的群組不會出現在列表（要透過群組紀錄查看）', () => {
    useGroupStore.setState({
      groups: [
        hostedGroup({ id: 'g1', serviceId: 'netflix', serviceName: 'Netflix', status: 'recruiting' }),
        hostedGroup({ id: 'g2', serviceId: 'spotify', serviceName: 'Spotify', status: 'cancelled' }),
      ],
    })
    renderManageGroupsPage()

    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.queryByText('Spotify')).not.toBeInTheDocument()
  })

  it('別人主持的群組不會出現在自己的群組管理列表', () => {
    useGroupStore.setState({
      groups: [hostedGroup({ id: 'g1', hostId: 'other-host', serviceId: 'netflix', serviceName: 'Netflix', status: 'recruiting' })],
    })
    renderManageGroupsPage()
    expect(screen.getByText('你還沒有建立任何群組')).toBeInTheDocument()
  })
})
