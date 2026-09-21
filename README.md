# stock-dashboard

台股策略儀表板：LINE LIFF 前端（`index.html`）＋ LINE webhook（`supabase/functions/line-webhook`）。

## LINE Webhook：取得使用者的 LINE userId

`stock-screener` 推播訊息時，需要知道要推給誰（`LINE_USER_IDS` 環境變數，逗號分隔的 userId 清單）。
在此之前，取得一個新使用者的 userId 得請他打開 LIFF 網頁再想辦法讀出來，很不直覺。

`supabase/functions/line-webhook/index.ts` 提供更簡單的方式：**使用者在 LINE 對小辣椒說「我的ID」，機器人會自動回覆他的 userId**，複製貼上即可加進 `LINE_USER_IDS`。

### 部署步驟

1. 安裝 [Supabase CLI](https://supabase.com/docs/guides/cli) 並登入：
   ```bash
   supabase login
   ```
2. 連結到現有的 Supabase 專案（project ref 可從 Supabase Dashboard 的網址或設定頁拿到）：
   ```bash
   supabase link --project-ref <你的-project-ref>
   ```
3. 部署 function（`--no-verify-jwt` 是必要的，因為 LINE 呼叫時不會帶 Supabase 的 JWT）：
   ```bash
   supabase functions deploy line-webhook --no-verify-jwt
   ```
4. 設定這支 function 需要的密鑰（跟 `stock-screener` 用的 `LINE_CHANNEL_ACCESS_TOKEN` 可以是同一組；`LINE_CHANNEL_SECRET` 則是另一組，在 LINE Developers Console 的 Basic settings 頁籤可以找到）：
   ```bash
   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=xxxx LINE_CHANNEL_SECRET=yyyy
   ```
5. 部署完成後會拿到一個網址，格式類似：
   ```
   https://<project-ref>.supabase.co/functions/v1/line-webhook
   ```
6. 到 [LINE Developers Console](https://developers.line.biz/console/) → 你的 Messaging API channel → **Messaging API** 分頁：
   - Webhook URL 貼上第 5 步拿到的網址
   - 打開「Use webhook」
   - 按「Verify」確認回應 200
   - 如果官方帳號有開「自動回應訊息」，建議關掉，避免跟這支 webhook 的回覆互相干擾

### 使用方式

任何加了官方帳號好友的人，在對話框輸入「我的ID」（或「id」「myid」「我的帳號」等，見程式碼裡的 `TRIGGER_WORDS`），機器人就會回覆：

```
你的 LINE userId 是：
Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

把這串貼給小助手，就能加進推播名單。
```

拿到 userId 後，把它加進 `stock-screener` repo 的 GitHub Actions secret `LINE_USER_IDS`（逗號分隔多個 userId）即可。

### 安全性

- 這支 function 會驗證 LINE 傳來的 `X-Line-Signature`（用 `LINE_CHANNEL_SECRET` 做 HMAC-SHA256），驗證失敗回 401，避免被偽造請求濫用。
- 除了觸發詞以外的訊息一律忽略、不回覆，不會變成通用聊天機器人。
