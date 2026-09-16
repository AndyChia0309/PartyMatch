import { toast as sonnerToast } from 'sonner'

// 手機瀏覽器把分頁切到背景時，JS 計時器常會被系統整個暫停，導致 toast 原本該
// 自動消失的倒數完全停擺；切回來的當下，那些理論上早就該消失的 toast 會維持
// 背景前的樣子原封不動地留在畫面上，還要再等它凍結前剩下的時間跑完才會消失。
// 分頁重新變成可視狀態時，把當下「非 persistent」的 toast 清空，避免使用者
// 看到過期內容——persistent 的 toast（版本更新提醒、資料載入失敗、通知彙總）
// 本來就是設計成不會自己倒數消失、要留給使用者看到才處理掉，不受這個機制影響。
const activeNonPersistentIds = new Set()

// Safari（尤其 macOS／iOS）在分頁失焦、切換 App、開啟網址列建議等情境下，
// 常常會短暫觸發 visibilitychange、把 document.hidden 瞬間切成 true 又馬上切回
// false，並不是真的把分頁背景化。如果沒有最短時間的判斷，這些瞬間閃爍會被
// 誤判成「切回分頁」，把剛跳出來、使用者根本還沒看到的 toast 一起清空，
// 導致 Safari 上有些通知 toast 看起來完全沒收到。
const STALE_TOAST_HIDDEN_THRESHOLD_MS = 3000

if (typeof document !== 'undefined') {
  let hiddenAt = null
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now()
      return
    }
    if (hiddenAt && Date.now() - hiddenAt >= STALE_TOAST_HIDDEN_THRESHOLD_MS) {
      activeNonPersistentIds.forEach(id => sonnerToast.dismiss(id))
      activeNonPersistentIds.clear()
    }
    hiddenAt = null
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
