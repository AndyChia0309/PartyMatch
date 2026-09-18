# UI/UX 前期製作文件

這個資料夾整理 PartyMatch 在 MVP 前期製作階段應該具備的 UI/UX 文件。既有的 `docs/product` 與 `docs/flows` 已經描述產品定位與各功能細節；這裡補上更偏設計前期的脈絡：資訊架構、跨角色使用者流程、人物誌與旅程、畫面狀態矩陣、設計交付檢核。

最後更新：2026-09-18

## 文件索引

| 文件 | 用途 |
|---|---|
| [資訊架構圖](./information-architecture.md) | 定義頁面、Modal、導覽、內容物件與權限分層，說明使用者如何理解整個產品 |
| [使用者流程圖](./user-flow-map.md) | 用跨角色流程圖串起探索、申請、審核、代管、啟用、續訂、申訴與通知 |
| [角色與使用者旅程](./user-roles-and-journeys.md) | 補齊 persona、Jobs To Be Done、成員/團主/管理員 journey map |
| [畫面狀態與互動矩陣](./screen-state-matrix.md) | 盤點主要頁面、空狀態、錯誤狀態、群組狀態對應操作與 Modal 分層 |
| [設計交付檢核表](./design-handoff-checklist.md) | 補齊 wireframe/prototype、內容策略、可用性測試、無障礙與上線前 UX 檢核 |

## 使用方式

- 改新增或移除路由、導覽入口、全域 Modal 時，更新 [資訊架構圖](./information-architecture.md)。
- 改變任一核心任務路徑，例如申請、審核、續訂、申訴時，更新 [使用者流程圖](./user-flow-map.md) 與對應 `docs/flows` 詳細流程。
- 改變群組狀態、可操作按鈕、提示文案、空狀態時，更新 [畫面狀態與互動矩陣](./screen-state-matrix.md)。
- 做 Figma、wireframe、prototype 或使用者測試前，先對照 [設計交付檢核表](./design-handoff-checklist.md)。

## 文件邊界

這些 UI/UX 文件負責回答「使用者怎麼理解與操作 PartyMatch」。後端資料表、API、交易一致性與工程決策仍以以下文件為主：

- [專案簡介](../product/product-overview.md)
- [頁面地圖](../product/page-map.md)
- [功能地圖](../product/feature-map.md)
- [群組狀態機](../flows/group-state-machine.md)
- [API 總覽](../architecture/api.md)
