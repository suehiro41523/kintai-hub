import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'
// pino-prettyはworker_threadsで整形処理を行うため、Cloudflare Workers上では動かない。
// Workers実行時は無効化し、通常のJSON1行ログにフォールバックする。
// globalThis.navigator.userAgentでの判定はCloudflareが案内している検出方法。
// @types/nodeのnavigator型定義に依存しないよう緩い型でアクセスする
const isWorkers =
  (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ===
  'Cloudflare-Workers'

export const logger = pino(
  isDev && !isWorkers
    ? {
        level: process.env.LOG_LEVEL ?? 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
          },
        },
      }
    : {
        level: process.env.LOG_LEVEL ?? 'info',
      },
)
