import process from 'node:process'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db/index.js'
import { authAccount, authSession, authUser, authVerification } from '../db/schema/auth.js'

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
  trustedOrigins: [(process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')],
})
