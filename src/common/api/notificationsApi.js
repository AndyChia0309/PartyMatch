import client from './axiosClient'

export async function readAllNotifications() {
  return client.get('/notifications')
}

export async function patchNotification(id) {
  return client.patch(`/notifications/${id}/read`)
}
