# すいどうやさん3.0

水道工事の現場ごとに、写真・図面（Jw_cad）・見積をまとめる Web アプリ。PC 優先。

## 構成

| 場所 | 中身 |
| --- | --- |
| `src/` | 画面（React）。ガラスの見た目は `src/styles/app.css`、アニメーションは motion |
| `src/pages/` | ログイン・現場一覧・現場の中（写真・図面・見積のタブ） |
| `src/components/Skeleton.tsx` | 読み込み中の全画面スケルトン |
| `src/lib/exif.ts` | 写真から撮影日時・撮影場所を読む（iPhone・Android の実機で確かめ済み） |
| `worker/` | 受け口（Cloudflare Workers + Hono） |
| `worker/auth.ts` | Google だけのログイン。`ALLOWED_EMAILS` のアカウントだけ入れる |
| `migrations/` | データベース（Cloudflare D1）の表 |
| `wrangler.jsonc` | Cloudflare の設定（D1・R2） |

## 手元で動かす

```bash
npm install
cp .dev.vars.example .dev.vars   # 値を入れる
npm run db:migrate:local
npm run dev
```

`.dev.vars` で `GOOGLE_CLIENT_ID` を空にして `DEV_LOGIN_EMAIL` を入れると、Google の設定なしで手元だけログインできる（本番では使われない）。

## Cloudflare に置く

1. D1 と R2 を作る：`npx wrangler d1 create suidouyasan` ／ `npx wrangler r2 bucket create suidouyasan-files`
2. 出てきた D1 の id を `wrangler.jsonc` の `database_id` に入れる
3. `vars` の `APP_URL` を本番のアドレスに、`ENVIRONMENT` を `production` にする
4. 秘密の値を入れる：`npx wrangler secret put GOOGLE_CLIENT_ID`（`GOOGLE_CLIENT_SECRET`・`ALLOWED_EMAILS` も同じ）
5. `npm run db:migrate:remote` → `npm run deploy`

Google のログインは、Google Cloud の「OAuth クライアント ID（ウェブ アプリケーション）」で作り、
承認済みのリダイレクト URI に `<APP_URL>/auth/google/callback` を入れる。

## これから足すもの

- 図面の比較：Jw_cad の図面（.jww）を読む部品（ezjww）は Workers の上では動かないため、Cloudflare Containers で動かす予定
- AI：図面の変更点のまとめは Cloudflare AI Gateway 経由で Claude、写真の仕分けは Workers AI
- 見積：Excel の型に書き込んで出す
