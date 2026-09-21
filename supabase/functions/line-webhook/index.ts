// LINE Messaging API webhook 接收端。
// 使用者傳「我的ID」（或同義詞）時，自動回覆他的 LINE userId，
// 方便把新使用者加進 stock-screener 的 LINE_USER_IDS 推播名單。
//
// 部署後，需在 LINE Developers Console -> Messaging API -> Webhook settings
// 把 Webhook URL 設成這支 function 的網址，並開啟 "Use webhook"。

const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

// 觸發回覆的關鍵字：全部轉小寫、去除頭尾空白後比對
const TRIGGER_WORDS = new Set([
  "我的id",
  "我的 id",
  "id",
  "myid",
  "我的userid",
  "我的帳號",
  "我的line id",
]);

async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature || !LINE_CHANNEL_SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

async function replyText(replyToken: string, text: string) {
  const res = await fetch(REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) {
    console.error("LINE reply failed", res.status, await res.text());
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!(await verifySignature(rawBody, signature))) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: { events?: any[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  for (const event of payload.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const text = String(event.message.text ?? "").trim().toLowerCase();
    if (!TRIGGER_WORDS.has(text)) continue;

    const userId = event.source?.userId;
    const replyToken = event.replyToken;
    if (!userId || !replyToken) continue;

    await replyText(
      replyToken,
      `你的 LINE userId 是：\n${userId}\n\n把這串貼給小助手，就能加進推播名單。`,
    );
  }

  // LINE 規定 webhook 一定要回 200，否則會重送同一個 event
  return new Response("ok", { status: 200 });
});
