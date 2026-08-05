import process from 'node:process'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { Resend } from 'resend'
import { db } from '../db/index.js'
import { authAccount, authSession, authUser, authVerification } from '../db/schema/auth.js'
import { logger } from './logger.js'

const isProduction = (process.env.BETTER_AUTH_URL ?? '').startsWith('https')

if (!process.env.RESEND_API_KEY) {
  throw new Error(
    'RESEND_API_KEY が設定されていません。.env に RESEND_API_KEY を設定してください。',
  )
}

const resend = new Resend(process.env.RESEND_API_KEY)
const emailFrom = process.env.EMAIL_FROM ?? 'KintaiHub <onboarding@resend.dev>'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  basePath: '/api/v1/auth',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-prod',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: false,
  },
  emailVerification: {
    expiresIn: 86400,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      if (!isProduction) {
        // ローカル開発時はResendの送信結果によらず確認URLをログ出力する。
        // resend.devサンドボックスはアカウント登録メール以外への送信が制限されており、
        // ドメイン未検証だと送信自体が失敗することがあるため、ログのURLを直接開いて検証できるようにする。
        logger.info({ email: user.email, url }, 'verification_email_link (dev only)')
      }

      const { error } = await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: '【KintaiHub】メールアドレスの確認をお願いします',
        text: `${user.name} 様

KintaiHubにご登録いただきありがとうございます。
以下のリンクをクリックして、メールアドレスの確認を完了してください。

${url}

※このリンクの有効期限は24時間です。期限が切れた場合は、
　サインアップ画面またはログイン後の画面から再送信してください。

※このメールにお心当たりがない場合は、破棄していただいて構いません。
　お客様のメールアドレスが誤って入力された可能性があります。

--
KintaiHub`,
      })

      if (error) {
        logger.error({ err: error, userId: user.id }, '確認メールの送信に失敗しました')
        throw new Error('確認メールの送信に失敗しました')
      }
    },
  },
  trustedOrigins: [(process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')],
  advanced: {
    defaultCookieAttributes: {
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
    },
  },
})
