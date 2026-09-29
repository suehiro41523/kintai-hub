import { app } from './app.js'

// Cloudflare Workers用のエントリーポイント（wrangler.toml の main）。
// ローカル開発用のNodeエントリーポイントは src/index.ts
export default app
