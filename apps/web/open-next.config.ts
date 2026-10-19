import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// 現状apps/webはサーバー側データ取得(ISR/on-demand revalidation)を使っていないため、
// R2キャッシュ等の追加設定は不要。最小構成
export default defineCloudflareConfig({})
