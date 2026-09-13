import { toast as sonnerToast } from 'sonner'

// 手機瀏覽器把分頁切到背景時，JS 計時器常會被系統整個暫停，導致 toast 原本該
// 自動消失的倒數完全停擺；切回來的當下，那些理論上早就該消失的 toast 會維持
// 背景前的樣子原封不動地留在畫面上，還要再等它凍結前剩下的時間跑完才會消失。
// 分頁重新變成可視狀態時，把當下「非 persistent」的 toast 清空，避免使用者
// 看到過期內容——persistent 的 toast（版本更新提醒、資料載入失敗、通知彙總）
// 本來就是設計成不會自己倒數消失、要留給使用者看到才處理掉，不受這個機制影響。
const activeNonPersistentIds = new Set()

if (typeof document !== 'undefined') {
  let wasHidden = false
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasHidden = true
      return
    }
    if (wasHidden) {
      wasHidden = false
      activeNonPersistentIds.forEach(id => sonnerToast.dismiss(id))
      activeNonPersistentIds.clear()
    }
  })
}

export function toast(message, type = 'success', options = {}) {
  const { persistent, duration, ...rest } = options
  const emit = sonnerToast[type] ?? sonnerToast.success
  const id = emit(message, { duration: persistent ? Infinity : duration, ...rest })
  if (!persistent) activeNonPersistentIds.add(id)
  return id
}

export function notifyError(err, fallback = '操作失敗，請稍後再試') {
  console.error(err)
  toast(err?.message ?? fallback, 'error')
}

export function dismissToast(id) {
  sonnerToast.dismiss(id);
}
