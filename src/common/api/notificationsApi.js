import client from './axiosClient'

export async function readAllNotifications() {
  return client.get('/notifications')
}

export async function patchNotification(id) {
  return client.patch(`/notifications/${id}/read`)
}

export async function deleteNotificationsByIds(ids) {
  return client.delete('/notifications', { data: { ids } })
}
