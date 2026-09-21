# 共享模式

## 概念

PartyMatch 的群組狀態機不會因為 Netflix、Spotify、YouTube 或 Apple 服務不同而拆成多套流程；主流程仍維持「招募、等待鎖定、服務設定、待啟用服務、確認進行中、服務進行中」。真正會變化的是 `pending_confirmation` 這一段要收集什麼資料、誰能看到資料、誰要在外部服務完成操作，以及後續問題回報要檢查什麼。

目前程式以 `sharingMethod` 定義服務共享方式。服務資料來源在 `src/common/data/serviceCatalog.js`，欄位與提示文字主要由 `src/common/utils/serviceInfoFields.js` 控制；若服務沒有指定模式，會以 `email_invite` 作為預設模式。共用帳密服務另由 `src/common/utils/hostCredentialFields.js` 定義團主需要提供的帳號欄位。

## 目前支援的共享模式

| 模式 | 適用服務範例 | 成員要提供 / 操作 | 團主要提供 / 操作 | 完成條件 | 主要風險 |
|---|---|---|---|---|---|
| `email_invite` | Spotify、ChatGPT、Cursor、Microsoft 365、Canva Pro、Notion、Dropbox、Duolingo、MasterClass、Nintendo | 填寫用於該服務的 Email | 依成員 Email 到外部服務送邀請或開通席位 | 成員送出 Email 後，平台視為完成服務資訊提供；團主仍需在外部完成邀請並回平台啟用 | Email 填錯、邀請未收到、外部服務席位尚未真正開通 |
| `email_invite_with_address` | KKBOX | 填寫 Email 與居住地址 | 使用成員資料完成家庭方案或地址驗證邀請 | 成員送出 Email 與地址後，平台視為完成服務資訊提供 | 地址格式需與外部服務完全一致，且地址屬於較敏感個資 |
| `google_family` | YouTube、Google One | 填寫 Google 帳戶 | 將成員加入 Google 家庭群組 | 成員送出 Google 帳戶後，平台視為完成服務資訊提供 | 家庭群組、媒體庫或付款設定可能牽涉其他 Google 家庭共享權益，且家庭成員異動有限制 |
| `apple_family` | Apple TV+、Apple Music、iCloud+、Apple One | 填寫 Apple ID | 將成員加入 Apple 家庭共享 | 成員送出 Apple ID 後，平台視為完成服務資訊提供 | Apple 家庭共享可能一併影響 App Store 購買、訂閱與 iCloud 相關權益，家庭成員異動限制較嚴 |
| `invite_code` | friDay 影音 | 成員先到外部服務 App 產生邀請碼，再回 PartyMatch 填寫 | 用成員提供的邀請碼完成綁定 | 成員送出邀請碼後，平台視為完成服務資訊提供 | 綁定方向與一般邀請相反，邀請碼可能失效或輸入錯誤 |
| `shared_credentials` | Netflix、Disney+、HBO Max、Discord、Crunchyroll、Claude、Midjourney、Adobe CC、NordVPN、ExpressVPN | 查看團主提供的帳密，確認可登入；部分影音服務需填自己的 Profile 名稱 | 鎖定群組時提供共用帳號資訊 | 成員勾選確認取得帳號資訊；有 Profile 欄位時也必須填寫 Profile 名稱 | 帳密截圖、轉傳、被改密碼、多人同時登入限制、服務條款風險 |

## 共用帳密欄位

`shared_credentials` 是風險最高的模式，因為成員會直接看到團主提供的帳號資訊。平台目前會加密儲存團主提供的帳密，並在前端顯示浮水印提醒，但仍無法技術上阻止截圖、轉傳或私下分享，因此這類服務需要更清楚的信用分數、評價與退出後改密碼提醒。

| 服務 | 團主需要提供 |
|---|---|
| Netflix、Disney+、HBO Max、Crunchyroll | 帳號 / Email、密碼、團主 Profile 名稱 |
| Discord、Claude | 帳號 / Email、密碼 |
| Midjourney | 帳號 / Email、密碼、Discord 邀請連結 |
| NordVPN、ExpressVPN | 帳號 / Email、密碼、可用裝置登入名額 |
| Adobe CC | 帳號 / Email、密碼；目前介面會額外提醒個人版帳號共用可能違反服務條款 |

成員端在共用帳密模式下不是「提供帳號給團主」，而是「提取團主提供的帳號資訊並確認已取得」。Netflix、Disney+、HBO Max、Crunchyroll 這類有 Profile 的服務，成員還需要填寫自己的 Profile 名稱，避免多人共用時互相影響觀看紀錄或使用體驗。

## 狀態機中的意義

| 群組階段 | 一般邀請型服務 | 家庭共享型服務 | 邀請碼型服務 | 共用帳密型服務 |
|---|---|---|---|---|
| `pending_confirmation` | 成員填 Email | 成員填 Google 帳戶或 Apple ID | 成員填外部服務產生的邀請碼 | 團主已提供帳密，成員提取並確認 |
| 帳號資訊問題回報 | Email 不正確、無法送邀請 | 帳戶不符合家庭群組條件 | 邀請碼錯誤或失效 | 帳密無法登入、Profile 資訊不清楚 |
| `pending_activation` | 團主已取得所有 Email，準備完成外部邀請 | 團主已取得家庭共享帳戶，準備加入家庭群組 | 團主已取得邀請碼，準備完成綁定 | 成員已提取帳密，團主準備確認服務可用 |
| `confirming` | 成員確認是否收到邀請且服務可用 | 成員確認家庭共享權益是否生效 | 成員確認綁定後服務是否可用 | 成員確認帳密可登入且功能正常 |

因此文件與介面上若只寫「填寫帳號資訊」，容易讓共用帳密、邀請碼或家庭共享服務看起來不精準。比較完整的產品語言可以使用「服務設定資訊」，再依模式顯示「填寫 Email」、「填寫 Apple ID」、「提供邀請碼」、「提取帳號資訊」等具體任務。

## 設計原則

- **主流程一致，任務依模式變化**：群組狀態不為每個服務重寫一套，但每個狀態內的任務、提示與問題回報理由要依 `sharingMethod` 調整。
- **最小揭露敏感資訊**：成員提供的 Email、地址、Apple ID、Google 帳戶與邀請碼只在必要角色與階段揭露；共用帳密只在群組鎖定後提供給成員。
- **逾期代表需要處理，不代表自動判決**：服務設定逾期後應先提醒、標記與升級處理，不應直接讓已進入敏感資訊交換的群組倒退成一般招募。
- **外部服務狀態由使用者回報**：PartyMatch 無法直接確認外部服務是否真的啟用，平台只能依團主啟用、成員確認、問題回報與平台介入來推進狀態。
- **共享模式要能擴充**：未來若新增「團主提供邀請連結」、「成員自行加入團隊空間」等模式，應先新增 `sharingMethod` 與欄位規則，再接到既有狀態機，而不是新增另一套群組流程。
