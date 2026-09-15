const PROFILE_ENABLED_SERVICE_IDS = ['netflix', 'disney', 'hbo', 'crunchyroll'];

export function serviceHasProfileField(serviceId) {
  return PROFILE_ENABLED_SERVICE_IDS.includes(serviceId)
}

const SHARING_METHOD_CONFIG = {
  apple_family: {
    fields: [
      { key: 'appleId', label: 'Apple ID', type: 'email', placeholder: 'example@icloud.com' },
    ],
    notice: '此服務透過 Apple「家庭共享」加入，團主會把你的 Apple ID 加進家庭群組。加入後會一併共用 App Store 購買紀錄等項目，且家庭群組成員一年僅能異動一次，請確認後再提供。',
    previewNotice: '此服務採用 Apple「家庭共享」機制：成員之後會提供 Apple ID，由你加進 Apple 家庭群組即可使用。加入後會一併共用 App Store 購買紀錄等項目，且家庭群組成員一年僅能異動一次，邀請成員前請先確認清楚。',
  },
  google_family: {
    fields: [
      { key: 'googleEmail', label: 'Google 帳戶：', type: 'email', placeholder: 'example@gmail.com' },
    ],
    notice: '此服務透過 Google 家庭群組加入，加入後會一併共用 Google Play 家庭媒體庫等項目，且家庭群組成員一年僅能異動一次，請確認後再提供。',
    previewNotice: '此服務採用 Google 家庭群組機制：成員之後會提供 Google 帳戶，由你加進 Google 家庭群組即可使用。加入後會一併共用 Google Play 家庭媒體庫等項目，且家庭群組成員一年僅能異動一次，邀請成員前請先確認清楚。',
  },
  email_invite: {
    fields: [
      { key: 'email', label: '帳號 Email', type: 'email', placeholder: 'example@gmail.com' },
    ],
    notice: null,
  },
  email_invite_with_address: {
    fields: [
      { key: 'email', label: '帳號 Email', type: 'email', placeholder: 'example@gmail.com' },
      { key: 'address', label: '居住地址', type: 'text', placeholder: '需與團主開通方案時填寫的地址完全一致' },
    ],
    notice: '此服務需要地址驗證才能加入家庭方案，請向團主確認開通時填寫的地址格式（含標點、大小寫），驗證地址須完全一致才能加入成功。',
    previewNotice: '此服務需要地址驗證才能加入家庭方案，成員之後填寫的居住地址必須跟你開通方案時填寫的地址完全一致（含標點、大小寫）才能加入成功，請先確認自己開通時填寫的地址格式。',
  },
  invite_code: {
    fields: [
      { key: 'inviteCode', label: '邀請碼', type: 'text', placeholder: '請先在服務 App 內產生邀請碼' },
    ],
    notice: '此服務的綁定方向相反：請先用你自己的帳號登入該服務 App，在「共享帳號管理」頁面產生邀請碼，再把邀請碼填在這裡交給團主完成綁定。',
    previewNotice: '此服務的綁定方向相反：不是由你發出邀請，而是由成員先在該服務 App 內產生邀請碼，之後再提供給你完成綁定。',
  },
  shared_credentials: {
    fields: [
      { key: 'acknowledged', label: '我已登入服務帳號並使用自己的 Profile 名稱', type: 'checkbox' },
    ],
    notice: '此服務官方沒有多人邀請功能，帳號密碼由團主在鎖定群組時統一提供，見下方「團主提供的帳號資訊」；確認可以登入後再勾選下方確認框。',
    previewNotice: '此服務官方沒有多人邀請功能，需要由你提供帳號密碼給成員共用登入，之後成員額滿、你確定招募到人後再統一提供即可。',
    bannerNotice: '請確認下方帳號密碼可登入後再勾選確認',
  },
};

const DEFAULT_METHOD = 'email_invite'

const PROFILE_NAME_FIELD = { key: 'memberProfileName', label: 'Profile 名稱：', type: 'text', placeholder: '請輸入Profile名稱' }
const ACKNOWLEDGED_ISSUE_LABEL = '我已處理回報問題並確認'

export function getSharingMethodConfig(sharingMethod, serviceId, { hasServiceInfoIssue } = {}) {
  const base = SHARING_METHOD_CONFIG[sharingMethod] ?? SHARING_METHOD_CONFIG[DEFAULT_METHOD]
  let fields = base.fields
  if (sharingMethod === 'shared_credentials' && hasServiceInfoIssue) {
    fields = fields.map(f => f.key === 'acknowledged' ? { ...f, label: ACKNOWLEDGED_ISSUE_LABEL } : f)
  }
  if (sharingMethod === 'shared_credentials' && serviceHasProfileField(serviceId)) {
    fields = [PROFILE_NAME_FIELD, ...fields]
  }
  return { ...base, fields }
}

export function isSharedCredentialsMethod(sharingMethod) {
  return sharingMethod === 'shared_credentials'
}

export function hasFilledServiceInfo(serviceInfo, sharingMethod, serviceId) {
  if (!serviceInfo) return false
  const { fields } = getSharingMethodConfig(sharingMethod, serviceId)
  return fields.every(({ key, type }) => {
    const value = serviceInfo[key]
    return type === 'checkbox' ? value === true : !!value?.toString().trim()
  })
}

export function getTextFields(sharingMethod, serviceId) {
  return getSharingMethodConfig(sharingMethod, serviceId).fields.filter(({ type }) => type !== 'checkbox')
}

export function getServiceInfoSummary(serviceInfo, sharingMethod, serviceId) {
  if (!serviceInfo) return null
  const parts = getTextFields(sharingMethod, serviceId)
    .map(({ key, label }) => serviceInfo[key] ? `${label.replace(/：$/, '')}：${serviceInfo[key]}` : null)
    .filter(Boolean)
  if (parts.length > 0) return parts.join('　')
  const { fields } = getSharingMethodConfig(sharingMethod, serviceId);
  return fields.some(({ key, type }) => type === 'checkbox' && serviceInfo[key]) ? '已確認取得帳號資訊' : null
}
