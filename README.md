# MoneyTwin｜未來有錢途

MoneyTwin 是一個個人財務數位分身與平行未來模擬原型。使用者可建立財務基本資料、加入生活事件，模擬未來 12 個月的現金流，並比較不同方案的期末餘額、最低水位與預備金風險。

本專案以 React、TypeScript 與 Vite 建置。財務模擬、情境編輯與資料保存在瀏覽器本機執行；AI 情境解析與 AI 決策教練為選用功能，需另行設定模型服務。

## 需求

- Node.js 24 或更新版本
- npm
- （選用）Ollama 本機模型，或可使用 OpenAI 相容 Chat Completions API 的模型服務

## 安裝與啟動

```bash
npm ci
npm run dev
```

開啟 Vite 在終端機顯示的網址即可使用。未設定 AI 時，財務模擬、情境編輯、規則分析與報告功能仍可使用。

正式建置與預覽：

```bash
npm run build
npm run preview
```

## 設定 AI 模型（選用）

模型金鑰只由 Node 後端讀取，切勿放進前端程式碼或提交到 Git。先複製範例設定檔：

```bash
cp .env.example .env
```

在 Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

編輯 `.env`，依模型服務填入設定。Ollama 範例：

```dotenv
LLM_PROVIDER=ollama
LLM_URL=http://127.0.0.1:11434/api/chat
LLM_MODEL=gemma4
LLM_API_KEY=
PORT=3001
```

OpenAI 相容服務範例：

```dotenv
LLM_PROVIDER=openai-compatible
LLM_URL=https://your-provider.example/v1/chat/completions
LLM_MODEL=your-model-name
LLM_API_KEY=your-secret-key
PORT=3001
```

請將範例網址、模型名稱與金鑰換成服務提供者給你的值。啟動後端：

```bash
npm run server
```

開發時另開一個終端機啟動前端：

```bash
npm run dev
```

Vite 會將 `/api` 請求代理至本機後端。若使用正式建置的靜態服務，先執行 `npm run build`，再執行 `npm run server`，預設由 `http://127.0.0.1:3001` 提供頁面。

`GET /api/health` 可查看模型設定狀態；`ready: true` 代表網址和模型名稱已設定，不保證遠端服務當下可連線。

### AI 資料傳送

- 按下「AI 理解情境」時，輸入的情境文字會送到 `.env` 指定的模型服務。
- 按下「生成 AI 決策說明」時，後端會收到方案名稱與模擬引擎整理的四項摘要事實。
- 財務模擬計算本身在瀏覽器本機完成。
- 請勿在情境文字中輸入姓名、帳號、密碼或其他不必要的個人資料。

## 功能

- 編輯稅後收入、固定與變動支出、存款、負債付款、預備金門檻及財務目標。
- 建立基準方案與多個生活事件方案，支援租屋、失業、收入變動、一次性支出、生活成本及進修等事件。
- 模擬未來 12 個月現金流，查看逐月明細、期末餘額、最低餘額與風險月份。
- 執行壓力測試與額外月租臨界值分析。
- 使用有限格式的本機自然語言解析，或連接 AI 模型解析情境；解析結果會先顯示參數與假設供確認。
- 保存及還原報告、匯出 CSV、下載 HTML 報告，以及匯入／匯出 JSON 備份。

## 計算口徑與限制

- 基本月現金流依收入、生活支出、負債付款及情境事件逐月計算。
- 租金、生活成本與進修事件代表原有預算以外的額外費用；請避免重複輸入已計入基本支出的金額。
- 一次性支出只在生效月份扣除；押金視為資金流出，不假設退還。
- 失業期間收入歸零；收入減少不會讓收入低於零。
- 模型不推算利息、投資報酬、物價、稅額或隨機事件機率。結果是依輸入假設進行的情境模擬，不是預測或財務建議。
- 本機文字解析僅支援有限格式；AI 解析結果也應逐項確認後再建立情境。

## API

| 方法與路徑 | 用途 |
| --- | --- |
| `GET /api/health` | 回報模型設定狀態 |
| `POST /api/parse` | 接收 `{ "prompt": "..." }`，回傳結構化事件及待確認事項 |
| `POST /api/coach` | 接收方案名稱及四項引擎摘要，回傳 AI 決策說明 |

後端 API 僅供本機原型使用，服務綁定 loopback，並設有來源、請求大小、輸入格式與逾時檢查。公開部署前需另行設計身分驗證、授權、限流與正式環境安全設定。

## 專案結構

```text
src/
  view/          React 畫面與互動流程
  interface/     財務資料與事件型別
  utils/         模擬引擎、本機解析、報告與資料處理
  style/         介面樣式
server/
  index.mjs      Node API、模型服務代理與建置檔案服務
tests/           模擬、解析、API、報告與介面測試
```

## 開發指令

```bash
npm run build   # TypeScript 檢查並建置
npm run lint    # 執行 ESLint
npm test        # 執行測試
```

## 機密與 Git

`.gitignore` 已排除 `.env` 與 `.env.local`。提交前可用以下指令確認 `.env` 沒有被追蹤：

```bash
git check-ignore -v .env
git ls-files .env
```

第一個指令應顯示忽略規則；第二個指令若沒有輸出，代表 `.env` 未納入版本控制。可以提交 `.env.example`，但其中只能放空白或虛構的範例值，不能放真實金鑰。

更多展示流程與實作說明請參閱 [README.moneytwin.md](README.moneytwin.md)。
