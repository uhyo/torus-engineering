# Torus Engineering

「ループを回すな、ループを巻け。」— AI駆動開発・第6世代パラダイム（たぶん）を提唱するコンセプトサイト。数学論文パロディの静的サイトで、Cloudflare Workers（静的アセット + 最小限のWorker）にデプロイする。

## ページ構成

| パス | 内容 |
|---|---|
| `/` | Accept-Language を見て `/ja/` または `/en/` へ 302 リダイレクト（Worker が処理） |
| `/ja/` `/en/` | トップページ（日英） |
| `/ja/klein/` `/en/klein/` | 付録：クラインの壺エンジニアリング（日英） |

## リポジトリ構成

```
src/            ページのソース（HTML / CSS / favicon / 404 / OGP画像）
src/figures/    生成されたSVG図（ビルド時に各ページへインライン展開）
scripts/        図とOGP画像のジェネレータ
worker/         Cloudflare Worker（"/" の言語リダイレクトのみ。他は静的配信）
build.mjs       ビルドスクリプト（src/ → dist/）
site.config.json  サイトの公開URL（OGP・canonical の絶対URLに使用）
wrangler.jsonc  Wrangler 設定（assets = ./dist）
```

ビルドは依存ゼロの Node スクリプトで、`{{ORIGIN}}` トークンの置換と図SVGのインライン展開だけを行う。ビルド後の `dist/` は静的ファイルのみで動作する。

## 開発

```sh
npm install          # wrangler のみ
npm run build        # dist/ を生成
npm run preview      # ビルドして wrangler dev（http://localhost:8787）
```

図を作り直す場合:

```sh
npm run figures            # トーラス・クラインの壺の SVG を再生成
node scripts/gen-og.mjs    # OGP画像（1200×630 PNG）を再生成（要 Chromium。CHROME=/path で指定可）
```

## デプロイ

1. `npm run deploy`（ビルドして `wrangler deploy`）
2. 発行された URL（例: `https://torus-engineering.xxx.workers.dev`）またはカスタムドメインを `site.config.json` の `origin` に設定
3. もう一度 `npm run deploy`

`origin` は OGP画像 (`og:image`)・`og:url`・canonical・hreflang の絶対URLに使われるため、正しく設定しないと X などでカードが展開されない。

## クレジット

本サイトは、AI駆動開発コミュニティのバズワード文化へのオマージュとして制作されたものです。
