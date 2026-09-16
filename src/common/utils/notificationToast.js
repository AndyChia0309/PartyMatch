export const BACKGROUND_NOTIFICATION_TOAST_DURATION = 8000;
export const INSTANT_NOTIFICATION_TOAST_DURATION = 4000;

export function getNotificationToastId(notification) {
  if (!notification) return null
  const { type, meta, id } = notification;
  return meta?.groupId ? `pm-${type}-${meta.groupId}` : id ?? null;
}

export function stripLabelPrefix(text, label) {
  if (!text || !label || !text.startsWith(label)) return text
  return text.slice(label.length).trim() || text
}

const suppressedToastUntil = new Map();

export function suppressNextToast(type, groupId, ms = BACKGROUND_NOTIFICATION_TOAST_DURATION + 10000) {
  if (!type || !groupId) return
  suppressedToastUntil.set(`${type}:${groupId}`, Date.now() + ms)
}

export function isToastSuppressed(type, groupId) {
  if (!type || !groupId) return false
  const key = `${type}:${groupId}`
  const until = suppressedToastUntil.get(key)
  if (!until) return false
  if (Date.now() > until) {
    suppressedToastUntil.delete(key)
    return false
  }
  return true
}
