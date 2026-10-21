# practice-submission-lookup — 課堂練習存摺（原名「練習作業查詢」）

學生輸入學號 → 查詢老師已登錄的課堂練習紀錄。2026-10-20 建立；2026-10-21 改名「課堂練習存摺」，標題下方標示課程「跨境電子商務」（repo 名與 Pages 網址維持不變，改了會斷連結）。

- 前端：單檔 `index.html`＋`manual.html`，公開 repo <https://github.com/M255525/practice-submission-lookup>，GitHub Pages（Actions，push master 自動部署）<https://m255525.github.io/practice-submission-lookup/>。本機預覽 port **8831**。
- 後端：`gas/` 是**獨立** Apps Script 專案（scriptId 見 `gas/.clasp.json`），Web App 以老師身分執行、任何人可存取。
  - 部署 ID `AKfycbzN8EP6-WxHqmXSRPhG-X5bDD-LWbYCsH5Ddg0mYLDaKo4rdZGw_CqBbugBUW6hCPBC`（寫死在 `index.html` 的 `API_URL`）。
  - 改 Code.gs 後：`cd gas && clasp push --force && clasp create-deployment --deploymentId <上面ID>`，**沿用同一 ID**，不要開新部署。
- 資料來源：試算表「上傳檔案分類」（`1RDZU3DyBfN_Y9j_xec6kH0GrAZY2CkoaTfzvvmFX5eA`）的「辨識結果」分頁，由 🔒 `小工具/line-notebook-ocr/` 寫入。查無資料時顯示的規範讀自「說明」分頁 A 欄（合併儲存格會重複讀到同段，連續重複會去掉）。
  - 刻意不改 line-notebook-ocr 的綁定腳本，避免 Web App 繼承它的 Drive 權限，也不碰那個不推遠端的 repo。

## 共用元件與設定（2026-10-21）
- 頂部跑馬燈：共用公告 GAS（`MARQUEE_CHECK_URL`，與其他工具同一支），含滑鼠移入暫停；`body.has-marquee` 讓出 30px。
- PWA：`manifest.json`＋`service-worker.js`（只快取同源檔案，**不快取查詢 API 回應**）＋`icons/`（PIL 產生的存摺圖示）；右上「📲 加入主畫面」。
- 訪客計數器：visitor-badge `m255525.practicesubmissionlookup`（說明頁加 `.manual`）。
- ⚙ 常用設定（localStorage `practiceLookup.settings`）：記住學號（預設開，關閉時會刪掉已存學號）、開頁自動查詢（需記住學號）、字體大小（`fs-l`/`fs-xl` 套在 body）、清除本機資料。

## 個資原則（真實學生姓名＋學號）
- 試算表維持私人，**不要**開「知道連結者可檢視」或發佈成 CSV。
- API 只回傳學號完全相符的列，白名單欄位見 `FIELDS`；姓名遮罩（`maskName_`，林*妤）；**不回傳**原始全文、圖片連結、檔名。
- 學號正規化：全形轉半形、只留英數、轉大寫，須 6～12 碼。

## 踩坑
- `SpreadsheetApp.openById` 需要完整 `spreadsheets` 權限，`spreadsheets.readonly` 會報「權限不足」。改權限範圍後，使用者要在編輯器重跑 `testLookup` 重新授權。
- Apps Script 回應時間 1～20 秒浮動，偶爾卡約 30 秒後 echo 端點回 404。對策：
  - `loadTable_` 把精簡表格（不含原始全文）放進 CacheService 5 分鐘（老師改試算表最多 5 分鐘後生效）。
  - 查無資料時，規範直接附在 `notice` 欄位一起回傳。
  - 前端 `fetchJson` 25 秒逾時、重試 1 次；開頁先打一次 `action=notice` 預熱；等待超過 5 秒顯示「請稍候」。
- clasp 3.x 的 `clasp create` 會把 appsscript.json 覆蓋成預設值（America/New_York），建完要改回來。
