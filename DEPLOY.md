# 部署教學：定然數位公關週報系統

## 總覽
完成這份教學後，你將擁有：
- 網址：https://【你的帳號】.github.io/notalone-report/
- 各品牌週報：https://【你的帳號】.github.io/notalone-report/#/brand/喬科國際教育

預計時間：約 45–60 分鐘（一次性設定）

---

## 第一步：申請 Anthropic API Key

1. 前往 https://console.anthropic.com
2. 點擊「Sign Up」，用 Email 或 Google 帳號註冊
3. 進入後點選左側「API Keys」
4. 點擊「Create Key」，命名為「notalone-report」
5. 複製 API Key（只顯示一次，請妥善保存）
6. 點擊左側「Billing」，新增信用卡（實際費用約 $0.08 美金/月）

---

## 第二步：設定 Google Cloud 專案

1. 前往 https://console.cloud.google.com
2. 點擊頂部「選取專案」→「新增專案」
   - 專案名稱：notalone-report
   - 點擊「建立」

3. 啟用 Google Sheets API：
   - 左側選單 → 「API 和服務」→「程式庫」
   - 搜尋「Google Sheets API」→ 點進去 → 「啟用」

4. 啟用 Google Drive API：
   - 同上，搜尋「Google Drive API」→「啟用」

5. 建立 OAuth 同意畫面：
   - 左側「API 和服務」→「OAuth 同意畫面」
   - 選擇「外部」→「建立」
   - 填入應用程式名稱：定然週報系統
   - 填入支援電子郵件：你的 Gmail
   - 點擊「儲存並繼續」（其他步驟直接下一步）

6. 建立 OAuth 2.0 憑證：
   - 左側「憑證」→「建立憑證」→「OAuth 用戶端 ID」
   - 應用程式類型選「網頁應用程式」
   - 名稱：notalone-report
   - 授權的 JavaScript 來源，新增：
     https://【你的GitHub帳號】.github.io
   - 點擊「建立」
   - 複製「用戶端 ID」（格式類似 xxxxx.apps.googleusercontent.com）

7. 建立 API 金鑰：
   - 「建立憑證」→「API 金鑰」
   - 複製 API 金鑰
   - 點擊「限制金鑰」→ API 限制 → 選擇 Sheets API 和 Drive API → 儲存

---

## 第三步：建立 Google Sheets 試算表

1. 前往 https://sheets.google.com，建立新試算表
2. 命名為「定然週報資料庫」
3. 依照 SHEETS_SETUP.md 的格式，建立各品牌分頁
4. 從網址列複製試算表 ID：
   https://docs.google.com/spreadsheets/d/【這裡就是ID】/edit

---

## 第四步：建立 Google Drive 資料夾

1. 前往 https://drive.google.com
2. 建立資料夾「週報檔案」
3. 在裡面為每個品牌建立子資料夾
4. 開啟「週報檔案」資料夾，從網址列複製資料夾 ID：
   https://drive.google.com/drive/folders/【這裡就是ID】

---

## 第五步：設定專案環境變數

1. 在專案根目錄，複製 .env.example 為 .env：
   cp .env.example .env

2. 用文字編輯器開啟 .env，填入所有值：
   REACT_APP_GOOGLE_API_KEY=第二步取得的API金鑰
   REACT_APP_GOOGLE_CLIENT_ID=第二步取得的用戶端ID
   REACT_APP_SPREADSHEET_ID=第三步取得的試算表ID
   REACT_APP_DRIVE_FOLDER_ID=第四步取得的資料夾ID
   REACT_APP_ANTHROPIC_API_KEY=第一步取得的API Key

---

## 第六步：安裝並測試

```bash
# 進入專案目錄
cd notalone-report

# 安裝套件
npm install

# 本機測試
npm start
```

瀏覽器開啟 http://localhost:3000/#/brand/喬科國際教育
確認可以正常讀取 Sheets 資料。

---

## 第七步：部署到 GitHub Pages

1. 開啟 package.json，將 homepage 改為你的實際網址：
   "homepage": "https://【你的GitHub帳號】.github.io/notalone-report"

2. 在 GitHub 建立名為 notalone-report 的 Repository（設為 Public）

3. 初始化並推送：
```bash
git init
git add .
git commit -m "初始化定然週報系統"
git branch -M main
git remote add origin https://github.com/【你的帳號】/notalone-report.git
git push -u origin main
```

4. 部署：
```bash
npm run deploy
```

5. 前往 GitHub Repository → Settings → Pages
   確認 Source 是 gh-pages 分支

6. 等待約 2 分鐘，前往：
   https://【你的GitHub帳號】.github.io/notalone-report/#/brand/喬科國際教育

---

## 第八步：建立品牌連結

每個品牌的連結格式：
https://【你的帳號】.github.io/notalone-report/#/brand/【品牌名稱】

現有品牌連結：
- 喬科國際教育：.../brand/喬科國際教育
- 傳裕鑄造：.../brand/傳裕鑄造
- 心夢想教育：.../brand/心夢想教育
- 黑洞：.../brand/黑洞
- 依蘭雅閑：.../brand/依蘭雅閑
- 巴索托：.../brand/巴索托

---

## 之後每週的工作流程（約 5 分鐘）

1. 開啟 Google Sheets，在對應品牌分頁新增一列
   - 填入週期、FB追蹤、IG追蹤、LINE好友

2. 將 Meta 匯出的 Excel 重新命名為 YYYY-MM-DD.xlsx
   上傳至 Google Drive 對應品牌資料夾

3. 完成！網站會自動讀取新資料
   - 廣告數據從 Excel 自動解析
   - 點擊週報上的「產出 AI 建議」按鈕，自動呼叫 Claude API
   - 建議文字自動寫回 Google Sheets

---

## 之後如何更新網站

如需調整畫面或功能：
1. 告訴 Claude 要改什麼
2. Claude 修改程式碼
3. 執行 npm run deploy
4. 約 1 分鐘後網站自動更新
