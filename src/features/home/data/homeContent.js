import creditPhoto from '../../../assets/Security.png'
import pmCoinPhoto from '../../../assets/UniquePMCoin.png'
import messagePhoto from '../../../assets/Message.png'
import studentsPhoto from '../../../assets/Students.png'
import couplesPhoto from '../../../assets/Couples.png'
import friendsPhoto from '../../../assets/Friends.png'
import familyPhoto from '../../../assets/Family.png'
import freelancerPhoto from '../../../assets/freelance worker.png'
import createGroupFlowVideo from '../../../assets/flow-videos/create-group-m.mp4'
import createGroupFlowVideoDesktop from '../../../assets/flow-videos/create-group-d.mp4'

export const HOME_INTRO_PILLARS = [
  {
    title: '尋找群組 & 建立群組',
    desc: '瀏覽現有群組直接申請，或自己開團設定服務與名額。',
  },
  {
    title: 'PM 幣代管交易',
    desc: '費用以 PM 幣代管，服務啟用前不撥款，降低詐騙風險。',
  },
  {
    title: '啟用服務 x 確認期',
    desc: '團主填服務資訊後啟用，成員仍有確認期可回報異常。',
  },
  {
    title: '續約提醒 & 信用評價',
    desc: '到期前自動提醒續約，結束後互評，累積信用分數。',
  },
  {
    title: '站內即時溝通',
    desc: '群組聊天室與通知系統，進度即時掌握不漏接。',
  },
  {
    title: '多元服務比價',
    desc: '收錄近 30 種熱門訂閱服務，官方價格清楚比對。',
  },
];

export const HOME_HOST_JOURNEY = [
  {
    id: 'create',
    title: '建立群組',
    badge: 'CREATE',
    desc: '選服務、設定方案與名額即可開放申請，方案價格系統自動核實，免自己找人湊團。',
    video: createGroupFlowVideo,
    videoDesktop: createGroupFlowVideoDesktop,
  },
  {
    id: 'manage',
    title: '群組管理',
    badge: 'MANAGE',
    desc: '審核申請、額滿鎖定共用帳密，成員確認可用後正式啟用；有問題可一鍵回報，客服介入處理。',
  },
  {
    id: 'renew',
    title: '續訂管理',
    badge: 'RENEWAL',
    desc: '到期前系統主動提醒，重新確認服務資訊，成員確認後即完成續約，原班人馬繼續使用。',
  },
  {
    id: 'other',
    title: '其他情境',
    badge: 'OTHERS',
    desc: '站內直接溝通免交換聯絡方式，PM 幣收款/儲值/消費紀錄一次查看，交易結束雙方互評累積信用。',
  },
];

export const HOME_MEMBER_JOURNEY = [
  {
    id: 'create',
    title: '加入群組',
    badge: 'CREATE',
    desc: '設定預算條件讓系統自動配對推薦群組，送出申請等待審核，免私訊團主喬時間。',
  },
  {
    id: 'manage',
    title: '使用與確認',
    badge: 'MANAGE',
    desc: '費用自動代管，48 小時內確認服務可用即可啟用；有問題可一鍵回報，代管款項全程凍結。',
  },
  {
    id: 'renew',
    title: '續約確認',
    badge: 'RENEWAL',
    desc: '到期前主動收到提醒，確認服務狀態沒問題即完成續約，不想續約也能隨時申請退出。',
  },
  {
    id: 'other',
    title: '其他情境',
    badge: 'OTHERS',
    desc: '站內直接溝通免交換聯絡方式，先收藏心動群組之後再比較，交易結束雙方互評累積信用。',
  },
];

export const HOME_WHY_US_HIGHLIGHTS = [
  {
    id: 'credit',
    tab: '真實信用機制',
    image: creditPhoto,
    title: '真實信用機制',
    desc: '每次合作結束後，團主與成員將互相評價：五星好評加分、一至二星差評扣分，累積成個人信用紀錄；申請加入前即可參考對方過往表現，團主也能設定最低信用分數門檻，過濾不良合作對象，降低雙方合作風險。',
  },
  {
    id: 'pm-coin',
    tab: '專屬PM幣支付',
    image: pmCoinPhoto,
    title: '專屬PM幣支付',
    desc: '站內交易統一以 PM 幣完成：申請加入時費用即由平台代管，服務啟用後仍有確認期，確認無誤才會撥款給團主；取消申請或審核未通過則全額退款，儲值、扣款與退款皆留有完整紀錄，如遇爭議也有明確依據可供查核與處理。',
  },
  {
    id: 'messaging',
    tab: '站內即時通訊',
    image: messagePhoto,
    title: '站內即時通訊',
    desc: '免交換聯絡方式即可直接傳訊：申請加入前可先私訊團主提問，合購成立後系統自動建立群組聊天室，方案協調、帳號資訊、回報問題都能在同一個地方溝通，通知中心也會即時提醒最新進度，所有紀錄完整留在站內不遺失。',
  },
];

export const HOME_AUDIENCES = [
  {
    photo: studentsPhoto,
    title: '學生族群',
    desc: '一起分擔娛樂訂閱費用，降低生活開銷。',
  },
  {
    photo: couplesPhoto,
    title: '情侶伴侶',
    desc: '共享串流服務更划算，讓追劇時光更豐富。',
  },
  {
    photo: familyPhoto,
    title: '家庭使用',
    desc: '家庭方案更划算，讓全家都能享受服務。',
  },
  {
    photo: friendsPhoto,
    title: '朋友同事',
    desc: '揪團一起訂閱，共享更划算。',
  },
  {
    photo: freelancerPhoto,
    title: '自由工作者',
    desc: '工作提效訂閱不孤單，一起管理更划算。',
  },
];

export const HOME_FAQS = [
  {
    q: 'PartyMatch 是什麼服務？',
    a: 'PartyMatch 是訂閱共享媒合平台，協助您找到願意共享 Netflix、Spotify、ChatGPT 等熱門訂閱服務的夥伴，共同分攤費用。從尋找群組、送出申請、款項代管到成員溝通，皆可於同一平台完成。',
  },
  {
    q: 'PM 幣如何保障交易安全？',
    a: '申請通過的同時，您的席位費用將自動從 PM 幣餘額轉入平台代管，服務啟用後另有 48 小時確認期。期間如有爭議可向平台回報問題，代管款項會全程凍結，確認無誤才會撥付給團主。',
  },
  {
    q: '如果找不到適合的共享群組怎麼辦？',
    a: '可以在「探索群組」頁使用「條件搜尋」設定服務、方案與預算等條件，篩出符合需求的群組；也可以自己建立群組，開放讓其他人申請加入。',
  },
  {
    q: '可以自己建立群組嗎？',
    a: '可以。登入後點擊「建立群組」，選擇服務、方案、設定名額與規則即可上架並開始招募，僅需幾個步驟即可完成。',
  },
  {
    q: '如何退出共享群組？',
    a: '可於「我的訂閱」查看目前加入的群組並提出退出申請；若服務有問題，也可以在確認期內向平台回報，由客服協助處理。',
  },
  {
    q: '共用的帳號密碼安全嗎？',
    a: '團主提供的共用帳密會加密儲存於資料庫，僅該群組的團主與成員本人能夠查看，平台不會外流給無關人員，降低帳號外洩風險。',
  },
  {
    q: '其他使用者會看到我的付款紀錄或帳戶餘額嗎？',
    a: '不會。PM 幣餘額與儲值紀錄僅本人可見，其他使用者只會看到與該次合購有關的代管、撥款金額，不會看到您的完整交易明細。',
  },
  {
    q: '如果團主遲遲不啟用服務怎麼辦？',
    a: '團主需在期限內填寫帳密並啟用服務，逾期群組會退回額滿狀態並扣除團主信用分數，需重新鎖定群組才能繼續流程。',
  },
  {
    q: '忘記密碼怎麼辦？',
    a: '於登入頁點選「忘記密碼」，輸入註冊信箱即可收到重設密碼的連結，重設完成後即可用新密碼登入。',
  },
];
